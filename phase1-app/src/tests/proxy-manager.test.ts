/**
 * Test proxy-manager lifecycle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProxyManager } from '../src/main/proxy-manager.ts';

test('ProxyManager starts and stops', async () => {
  const pm = new ProxyManager();
  assert.equal(pm.isRunning(), false);
  const info = await pm.start({ tcpPort: 25577, upstreamUrl: 'wss://example.com' });
  assert.equal(info.tcpPort, 25577);
  assert.equal(info.upstream, 'wss://example.com');
  assert.equal(pm.isRunning(), true);
  const stats = pm.getStats();
  assert.equal(stats.running, true);
  assert.equal(stats.bytesUp, 0);
  await pm.stop();
  assert.equal(pm.isRunning(), false);
});

test('ProxyManager.start is idempotent (restarts)', async () => {
  const pm = new ProxyManager();
  await pm.start({ tcpPort: 25578, upstreamUrl: 'wss://a.com' });
  await pm.start({ tcpPort: 25579, upstreamUrl: 'wss://b.com' });
  assert.equal(pm.isRunning(), true);
  assert.equal(pm.getStats().tcpPort, 25579);
  await pm.stop();
});
