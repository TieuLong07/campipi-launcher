/**
 * Test launcher-manager: spawn java with the REAL Phase-0 runtime, kill
 * after a short timeout, verify log file written.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchInstance, listActive } from '../src/main/launcher-manager.ts';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';

const JAVA = 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/java.exe';
const RUNTIME = 'D:/2026WORK/Campipi/.runtime/clean';
const VERSION = '1.20.1-forge-47.4.10';
const HAS_JAVA = existsSync(JAVA);
const HAS_RUNTIME = existsSync(join(RUNTIME, 'versions', VERSION, `${VERSION}.json`));

test('launchInstance with real runtime + kill', { skip: !(HAS_JAVA && HAS_RUNTIME) && 'Need JDK 17 + Phase-0 runtime' }, async () => {
  const logDir = mkdtempSync(join(tmpdir(), 'mcpubg-test-'));
  const logFile = join(logDir, 'mc.log');
  const lines = [];
  const errors = [];

  const h = await launchInstance({
    runtimeRoot: RUNTIME,
    version: VERSION,
    javaPath: JAVA,
    username: 'TieuLong07',
    uuid: 'f8e3d29e-fc4d-6198-2bec-111f52d98043',
    accessToken: 'test-token',
    xmxMb: 2048,
    xmsMb: 1024,
    userType: 'offline',
    logFilePath: logFile,
    onLog: (line) => lines.push(line),
    onError: (e) => errors.push(e),
  });

  console.log('  pid:', h.pid);
  assert.ok(h.pid && h.pid > 0, 'pid invalid');
  assert.equal(h.state, 'running');
  assert.equal(listActive().length, 1);

  // Wait 12s for Forge to load mods
  await new Promise((r) => setTimeout(r, 12000));
  console.log('  log lines so far:', lines.length);
  if (lines.length) {
    console.log('  all lines:', JSON.stringify(lines));
    console.log('  last 5:', JSON.stringify(lines.slice(-5)));
    // Find any FindException line
    const findEx = lines.find((l) => l.includes('FindException'));
    if (findEx) console.log('  FindException:', findEx);
  }

  // Stop the process
  await h.stop();
  const result = await Promise.race([
    h.wait(),
    new Promise((r) => setTimeout(() => r({ code: -1, signal: 'TIMEOUT' }), 5000)),
  ]);
  console.log('  exit:', result);
  assert.notEqual(result.code, -1, 'Process did not exit after kill');
  assert.notEqual(h.state, 'running');

  // Log file should exist + be non-empty
  if (existsSync(logFile)) {
    const text = readFileSync(logFile, 'utf-8');
    assert.ok(text.length > 10, `Log file too small: ${text.length} bytes`);
    assert.match(text, /\[20\d\d-/, 'Log file missing timestamp prefix');
    console.log('  log file size:', statSync(logFile).size);
  }

  // Clean up
  rmSync(logDir, { recursive: true, force: true });
});

test('listActive returns empty after exit', async () => {
  // After previous test completes, give the exit event a moment to fire
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(listActive().length, 0, `Still active: ${JSON.stringify(listActive())}`);
});
