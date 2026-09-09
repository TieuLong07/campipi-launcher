/**
 * Integration test: instance-adapter must read the Phase-0 runtime install and
 * produce a renderer AppState with at least one ready Forge instance.
 *
 * This is the contract the renderer depends on. If the structure changes,
 * smoke tests will fail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const RUNTIME = 'D:/2026WORK/Campipi/.runtime/clean';
const JAVA = 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/javaw.exe';

function loadState() {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npx.cmd' : 'npx';
  const out = execFileSync(
    cmd,
    ['tsx', 'tests/_print-state.ts'],
    { encoding: 'utf-8', cwd: ROOT, shell: true,
      env: { ...process.env, MCPUBG_RUNTIME: RUNTIME, MCPUBG_JAVA: JAVA } },
  );
  return JSON.parse(out.trim());
}

test('adapter returns at least one instance', () => {
  const s = loadState();
  assert.ok(s.instances.length >= 1, `Expected ≥ 1 instance, got ${s.instances.length}`);
});

test('adapter reports Forge 47.4.10 as ready', () => {
  const s = loadState();
  const forge = s.instances.find((i) => i.id === '1.20.1-forge-47.4.10');
  assert.ok(forge, `Forge instance not found. Available: ${s.instances.map((i) => i.id).join(', ')}`);
  assert.equal(forge.status, 'ready', `Forge status should be 'ready' when client jar exists, got '${forge.status}'`);
  assert.match(forge.statusText, /Sẵn sàng/);
  // Forge has 49 mods in the runtime, so it must be the auto-selected default.
  assert.equal(forge.badge?.label, 'ĐANG CHỌN', 'Forge with mods should be the auto-selected instance');
  assert.equal(s.selectedInstanceId, '1.20.1-forge-47.4.10');
});

test('adapter detects Java correctly', () => {
  const s = loadState();
  assert.equal(s.java.ok, true);
  assert.match(s.java.path, /javaw\.exe$/);
});

test('adapter default RAM is 4096 MB and hasUpdate true', () => {
  const s = loadState();
  assert.equal(s.ramMaxMb, 4096);
  assert.equal(s.hasUpdate, true);
});
