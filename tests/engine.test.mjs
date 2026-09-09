import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { access } from 'node:fs/promises';

const moduleUrl = new URL('../src/engine.mjs', import.meta.url);
test('engine adapter exists', async () => {
  await assert.doesNotReject(access(moduleUrl));
});
test('launch options use standard metadata and explicit demo mode, never inject mod classpath', async () => {
  const { createLaunchOptions } = await import(moduleUrl);
  const o = createLaunchOptions({ root: path.resolve('.runtime/clean'), java: 'C:/Java17/bin/java.exe', version: '1.20.1-forge-47.4.10' });
  assert.equal(o.demo, true);
  assert.equal(o.gamePath, path.resolve('.runtime/clean'));
  assert.deepEqual(o.extraJVMArgs, []);
  assert.equal(o.extraClassPaths, undefined);
  assert.equal(o.server, undefined);
  assert.equal(o.maxMemory, 4096);
});
test('relative install root and blank java path are rejected', async () => {
  const { createLaunchOptions } = await import(moduleUrl);
  assert.throws(() => createLaunchOptions({root: 'relative', java:'java', version:'x'}), /absolute/);
  assert.throws(() => createLaunchOptions({root: path.resolve('.runtime'), java:'', version:'x'}), /Java/);
});
test('download verification rejects corrupted installer bytes', async () => {
  const { verifySha1 } = await import(moduleUrl);
  assert.equal(verifySha1(Buffer.from('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d'), true);
  assert.throws(() => verifySha1(Buffer.from('bad'), 'a9993e364706816aba3e25717850c26c9cd0d89d'), /checksum/);
  assert.throws(() => verifySha1(Buffer.from('abc'), 'broken'), /checksum/);
});
