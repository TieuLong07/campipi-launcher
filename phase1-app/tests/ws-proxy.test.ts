/**
 * Test ws-proxy with a fake upstream WS server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import { createConnection } from 'node:net';
import { WsProxy } from '../src/main/ws-proxy.ts';

const PROXY_TCP_PORT = 25566;

async function startFakeUpstream(): Promise<{ port: number; receivedFromClient: Buffer[]; close: () => void }> {
  const receivedFromClient: Buffer[] = [];
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  wss.on('connection', (ws) => {
    ws.on('message', (data, isBinary) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      receivedFromClient.push(buf);
      // Echo back with a header byte
      const reply = Buffer.concat([Buffer.from([0xfe]), buf]);
      ws.send(reply, { binary: true });
    });
  });
  await new Promise<void>((resolve) => wss.on('listening', () => resolve()));
  const addr = wss.address() as { port: number };
  return {
    port: addr.port,
    receivedFromClient,
    close: () => wss.close(),
  };
}

test('WsProxy forwards bytes TCP→WS and WS→TCP', async () => {
  const upstream = await startFakeUpstream();
  const proxy = new WsProxy({
    tcpPort: PROXY_TCP_PORT,
    upstreamUrl: `ws://127.0.0.1:${upstream.port}`,
  });
  await proxy.start();

  // Wait for the upstream WS to be ready
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(proxy.isReady(), 'proxy should be ready after start()');

  // Connect a TCP client
  const sock = createConnection({ port: PROXY_TCP_PORT, host: '127.0.0.1' });
  await new Promise<void>((resolve) => sock.once('connect', () => resolve()));

  const received: Buffer[] = [];
  sock.on('data', (d: Buffer) => received.push(d));

  // Send a fake MC handshake packet
  const handshake = Buffer.from([0x10, 0x00, 0xff, 0xff, 0xff, 0xff, 0x0f]);
  sock.write(handshake);

  // Wait for the round-trip
  await new Promise((r) => setTimeout(r, 500));

  // Verify the upstream WS got the bytes
  assert.equal(upstream.receivedFromClient.length, 1, 'upstream should have received 1 message');
  assert.deepEqual(upstream.receivedFromClient[0], handshake, 'upstream got the same bytes');

  // Verify the TCP client got the echo back
  assert.ok(received.length >= 1, 'client should have received at least 1 message');
  assert.deepEqual(received[0].slice(1), handshake, 'client got the echo with header byte');

  // Cleanup
  sock.destroy();
  await proxy.stop();
  upstream.close();
});

test('WsProxy.stop() is idempotent and safe', async () => {
  const upstream = await startFakeUpstream();
  const proxy = new WsProxy({
    tcpPort: PROXY_TCP_PORT + 1,
    upstreamUrl: `ws://127.0.0.1:${upstream.port}`,
  });
  await proxy.start();
  await new Promise((r) => setTimeout(r, 200));
  await proxy.stop();
  // Second stop should not throw
  await proxy.stop();
  upstream.close();
});
