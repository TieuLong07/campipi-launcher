/**
 * WebSocket proxy: 127.0.0.1:25566 (TCP) → wss://mc.tiulong.site (TCP-over-WS).
 *
 * Why: most home routers block incoming connections. The VPS (mc.tiulong.site)
 * accepts our WebSocket upgrade on port 8081, and forwards bytes to MC :25565
 * via a long-running wsproxy (already running on the VPS — see
 * docs/evidence/phase-0). The launcher doesn't know about WS — it just
 * connects to 127.0.0.1:25566 like a normal MC server.
 *
 * Architecture:
 *   MC client ── TCP ──> 127.0.0.1:25566
 *                          ↓ (this proxy)
 *   MC client <── TCP ── 127.0.0.1:25566
 *                          ↓ (WebSocket upgrade)
 *   VPS wsproxy ── TCP ──> MC :25565
 *
 * Pitfalls:
 *  - MC handshake is binary VarInt-prefixed; we MUST NOT translate, just
 *    forward bytes as-is.
 *  - The WS connection is one-to-many TCP→WS, but MC only needs ONE TCP
 *    connection per client. So one WS upstream per launch.
 *  - If the upstream WS dies (VPS reboot, network blip), we need to reconnect
 *    with exponential backoff and re-bind the TCP port.
 *  - `ws` library on Node has had bugs with binary frames; we use
 *    `{ binaryType: 'arraybuffer' }` to be safe.
 */
import { createServer, Socket, Server } from 'node:net';
import { WebSocket } from 'ws';
import { EventEmitter } from 'node:events';

export interface ProxyEvents {
  /** A TCP client connected and we opened a WS upstream. */
  clientConnect: (info: { clientAddr: string; upstream: string }) => void;
  /** A TCP client disconnected (and we tore down the WS). */
  clientDisconnect: (info: { clientAddr: string; bytesUp: number; bytesDown: number }) => void;
  /** Upstream WS connection lost (we'll auto-reconnect). */
  upstreamLost: (err: Error) => void;
  /** Upstream WS connection restored. */
  upstreamRestored: () => void;
  /** Bytes proxied (sampled for logs). */
  traffic: (info: { dir: 'up' | 'down'; bytes: number }) => void;
}

export interface ProxyOptions {
  /** Local TCP port to listen on (default 25566). */
  tcpPort?: number;
  /** Upstream WS URL (e.g. 'wss://mc.tiulong.site'). */
  upstreamUrl: string;
  /** Upstream path (default '/'). */
  upstreamPath?: string;
}

export class WsProxy extends EventEmitter {
  private server: Server | null = null;
  private upstream: WebSocket | null = null;
  private clients = new Map<Socket, { bytesUp: number; bytesDown: number }>();
  private opts: Required<ProxyOptions>;
  private shuttingDown = false;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30_000;

  constructor(opts: ProxyOptions) {
    super();
    this.opts = {
      tcpPort: opts.tcpPort ?? 25566,
      upstreamUrl: opts.upstreamUrl,
      upstreamPath: opts.upstreamPath ?? '/',
    };
  }

  /** Start the proxy. Resolves once the TCP server is listening. */
  start(): Promise<void> {
    if (this.server) return Promise.resolve();
    this.shuttingDown = false;
    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => this.onTcpClient(socket));
      this.server.once('error', reject);
      this.server.listen(this.opts.tcpPort, '127.0.0.1', () => {
        this.server?.off('error', reject);
        // Open the upstream WS now (so MC client connecting later doesn't
        // wait for the upgrade).
        this.openUpstream();
        resolve();
      });
    });
  }

  /** Stop the proxy: close all TCP clients, close WS, close server. */
  async stop(): Promise<void> {
    this.shuttingDown = true;
    for (const [sock] of this.clients) {
      sock.destroy();
    }
    this.clients.clear();
    if (this.upstream) {
      try { this.upstream.close(); } catch { /* ignore */ }
      this.upstream = null;
    }
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
  }

  /** Is the proxy currently listening + has an upstream? */
  isReady(): boolean {
    return this.server !== null && this.upstream !== null && this.upstream.readyState === WebSocket.OPEN;
  }

  // --- internals ---

  private openUpstream(): void {
    if (this.shuttingDown) return;
    const url = this.opts.upstreamUrl + this.opts.upstreamPath;
    const ws = new WebSocket(url);
    // binaryType is a runtime property on WebSocket instance, not a constructor option.
    (ws as any).binaryType = 'arraybuffer';
    this.upstream = ws;
    ws.on('open', () => {
      this.reconnectDelay = 1000;  // reset backoff
      this.emit('upstreamRestored');
    });
    ws.on('message', (data) => {
      // Server → MC client. data is Buffer | ArrayBuffer; for binary we
      // need to convert to Buffer to write to TCP socket.
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      for (const [sock, stats] of this.clients) {
        stats.bytesDown += buf.length;
        this.emit('traffic', { dir: 'down', bytes: buf.length });
        sock.write(buf);
      }
    });
    ws.on('close', (code, reason) => {
      this.upstream = null;
      if (this.shuttingDown) return;
      this.emit('upstreamLost', new Error(`Upstream closed: ${code} ${reason}`));
      this.scheduleReconnect();
    });
    ws.on('error', (err) => {
      // 'close' will fire next; don't double-emit.
      // (we still want to know about errors for logging)
      this.emit('upstreamLost', err);
    });
  }

  private scheduleReconnect(): void {
    if (this.shuttingDown) return;
    setTimeout(() => {
      if (this.shuttingDown) return;
      this.openUpstream();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private onTcpClient(socket: Socket): void {
    const stats = { bytesUp: 0, bytesDown: 0 };
    this.clients.set(socket, stats);
    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    this.emit('clientConnect', { clientAddr: addr, upstream: this.opts.upstreamUrl });

    socket.on('data', (data: Buffer) => {
      stats.bytesUp += data.length;
      this.emit('traffic', { dir: 'up', bytes: data.length });
      // Forward to upstream WS
      const ws = this.upstream;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data, { binary: true });
      } else {
        // Upstream not ready; drop the bytes. MC will retry on TCP timeout.
        // We could buffer here, but that risks OOM on a long outage.
      }
    });
    socket.on('close', () => {
      this.emit('clientDisconnect', { clientAddr: addr, bytesUp: stats.bytesUp, bytesDown: stats.bytesDown });
      this.clients.delete(socket);
    });
    socket.on('error', () => {
      // 'close' will fire
    });
  }
}
