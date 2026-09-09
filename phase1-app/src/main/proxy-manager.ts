/**
 * Proxy manager: lifecycle for the embedded WebSocket proxy that bridges
 * MC client (127.0.0.1:25566) to VPS (wss://mc.tiulong.site).
 *
 * Used by:
 *  - Phase 3C WebSocket proxy embedded
 *  - Sidebar/Cards UI to show "Đang chuyển tiếp qua máy chủ TieuLong"
 */
import { WsProxy } from './ws-proxy.js';
import { EventEmitter } from 'node:events';

export interface ProxyManagerEvents {
  started: (info: { tcpPort: number; upstream: string }) => void;
  stopped: () => void;
  upstreamLost: (err: Error) => void;
  upstreamRestored: () => void;
  clientConnect: (info: { clientAddr: string }) => void;
  clientDisconnect: (info: { clientAddr: string; bytesUp: number; bytesDown: number }) => void;
}

const DEFAULT_UPSTREAM = 'wss://mc.tiulong.site';
const DEFAULT_TCP_PORT = 25566;

export class ProxyManager extends EventEmitter {
  private proxy: WsProxy | null = null;
  private currentUpstream: string;
  private currentPort: number;
  private bytesUp = 0;
  private bytesDown = 0;
  private clients = 0;
  private _starting = false;

  constructor() {
    super();
    this.currentUpstream = DEFAULT_UPSTREAM;
    this.currentPort = DEFAULT_TCP_PORT;
    
    // Auto-start proxy on launcher startup (with delay to avoid startup issues)
    setTimeout(() => {
      this.start().catch(err => {
        console.error('[ProxyManager] Auto-start failed:', err);
      });
    }, 1000);
  }

  /** Start the embedded proxy. Idempotent. */
  async start(opts?: { upstreamUrl?: string; tcpPort?: number }): Promise<{ tcpPort: number; upstream: string }> {
    if (this._starting) throw new Error('Proxy already starting');
    if (opts?.upstreamUrl) this.currentUpstream = opts.upstreamUrl;
    if (opts?.tcpPort) this.currentPort = opts.tcpPort;
    if (this.proxy) await this.stop();
    
    this._starting = true;
    try {
      this.proxy = new WsProxy({ tcpPort: this.currentPort, upstreamUrl: this.currentUpstream });
      // Forward events with byte counters
      this.proxy.on('clientConnect', (info) => {
        this.clients++;
        this.emit('clientConnect', info);
      });
      this.proxy.on('clientDisconnect', (info) => {
        this.clients = Math.max(0, this.clients - 1);
        this.emit('clientDisconnect', info);
      });
      this.proxy.on('upstreamLost', (err) => this.emit('upstreamLost', err));
      this.proxy.on('upstreamRestored', () => this.emit('upstreamRestored'));
      this.proxy.on('traffic', (info) => {
        if (info.dir === 'up') this.bytesUp += info.bytes;
        else this.bytesDown += info.bytes;
      });
      await this.proxy.start();
      this.emit('started', { tcpPort: this.currentPort, upstream: this.currentUpstream });
      return { tcpPort: this.currentPort, upstream: this.currentUpstream };
    } catch (err) {
      this.proxy = null;
      throw err;
    } finally {
      this._starting = false;
    }
  }

  async stop(): Promise<void> {
    if (this.proxy) {
      await this.proxy.stop();
      this.proxy = null;
    }
    this.clients = 0;
    this.bytesUp = 0;
    this.bytesDown = 0;
    this.emit('stopped');
  }

  isRunning(): boolean {
    return this.proxy !== null;
  }

  getStats() {
    return {
      running: this.isRunning(),
      upstream: this.currentUpstream,
      tcpPort: this.currentPort,
      bytesUp: this.bytesUp,
      bytesDown: this.bytesDown,
      clients: this.clients,
    };
  }
}
