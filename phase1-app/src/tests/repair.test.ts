/**
 * Test repair module: verify, SHA1, cleanNatives, rotateLogs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRuntime, sha1, cleanNativesDir, rotateLogs } from '../main/repair.ts';

const RUNTIME = 'D:/2026WORK/Campipi/.runtime/clean';
const VERSION = '1.20.1-forge-47.4.10';

test('checkRuntime reports all OK for the real Phase-0 runtime', { skip: true }, () => {
  // SKIPPED: .runtime/clean uses root mods/ layout, not TLauncher per-instance.
  // Use %APPDATA%/.minecraft for real testing.
  const results = checkRuntime({ runtimeRoot: RUNTIME, version: VERSION, instanceName: 'cam' });
  console.log('  ', results.map(r => `${r.name}:${r.status}`).join(', '));
  // We expect at least these to be OK
  const ok = results.filter(r => r.status === 'ok').map(r => r.name);
  assert.ok(ok.includes('version-dir'), 'version-dir should be ok');
  assert.ok(ok.includes('client-jar'), 'client-jar should be ok');
  assert.ok(ok.includes('version-json'), 'version-json should be ok');
  assert.ok(ok.includes('mods-dir'), 'mods-dir should be ok (49 mods)');
  // No fatal failures expected
  const fails = results.filter(r => r.status === 'fail');
  assert.equal(fails.length, 0, `No fails expected; got: ${fails.map(f => f.name).join(', ')}`);
});

test('checkRuntime reports missing version dir', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'repair-'));
  const results = checkRuntime({ runtimeRoot: tmp, version: '1.20.1-fake' });
  assert.equal(results[0].status, 'fail');
  assert.equal(results[0].name, 'version-dir');
});

test('checkRuntime reports missing client jar', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'repair-'));
  mkdirSync(join(tmp, 'versions', '1.20.1-fake'), { recursive: true });
  writeFileSync(join(tmp, 'versions', '1.20.1-fake', '1.20.1-fake.json'), '{}');
  const results = checkRuntime({ runtimeRoot: tmp, version: '1.20.1-fake' });
  const clientJar = results.find(r => r.name === 'client-jar');
  assert.equal(clientJar?.status, 'fail');
});

test('sha1 computes correct hash', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sha1-'));
  const p = join(tmp, 'test.txt');
  writeFileSync(p, 'hello');
  // Known SHA1 of 'hello'
  assert.equal(sha1(p), 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
});

test('cleanNativesDir removes META-INF + natives', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'natives-'));
  writeFileSync(join(tmp, 'META-INF.MF'), 'noise');
  writeFileSync(join(tmp, 'opengl32.dll'), 'dll');
  writeFileSync(join(tmp, 'libgl.so'), 'so');
  writeFileSync(join(tmp, 'real-config.json'), '{}');
  const removed = cleanNativesDir(tmp);
  assert.ok(removed >= 3, `Should remove at least 3 files, got ${removed}`);
  assert.ok(existsSync(join(tmp, 'real-config.json')), 'non-native file should stay');
});

test('rotateLogs keeps only N newest', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'logs-'));
  for (let i = 0; i < 15; i++) {
    writeFileSync(join(tmp, `log-${i}.log`), `entry ${i}`);
    // Set explicit mtime so we know order
    const past = new Date(Date.now() - (15 - i) * 1000);
    require('node:fs').utimesSync(join(tmp, `log-${i}.log`), past, past);
  }
  const removed = rotateLogs(tmp, 5);
  assert.equal(removed, 10, 'should remove 10 oldest');
  const remaining = readdirSync(tmp).filter(f => f.endsWith('.log'));
  assert.equal(remaining.length, 5);
});
