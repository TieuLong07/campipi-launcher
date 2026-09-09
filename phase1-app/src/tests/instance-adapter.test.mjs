/**
 * Integration test: instance-adapter must read the user's .minecraft folder
 * and produce a renderer AppState with at least one ready Forge instance.
 *
 * This is the contract the renderer depends on. If the structure changes,
 * smoke tests will fail.
 *
 * Default runtime: TLauncher-compatible layout at
 *   %APPDATA%/.minecraft/  (override via MCPUBG_RUNTIME env)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..'); // src/tests/ → src/ → phase1-app/
const RUNTIME = process.env.MCPUBG_RUNTIME ?? 'C:/Users/ADMIN/AppData/Roaming/.minecraft';
const JAVA = process.env.MCPUBG_JAVA ?? 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/javaw.exe';

function loadState() {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npx.cmd' : 'npx';
  const out = execFileSync(
    cmd,
    ['tsx', 'src/tests/_print-state.ts'],
    { encoding: 'utf-8', cwd: ROOT, shell: true,
      env: { ...process.env, MCPUBG_RUNTIME: RUNTIME, MCPUBG_JAVA: JAVA } },
  );
  return JSON.parse(out.trim());
}

test('adapter returns at least one instance', () => {
  const s = loadState();
  assert.ok(s.instances.length >= 1, `Expected ≥ 1 instance, got ${s.instances.length}`);
});

test('adapter has a selected instance', () => {
  const s = loadState();
  assert.ok(s.selectedInstanceId, 'selectedInstanceId must be set');
  assert.ok(
    s.instances.some((i) => i.id === s.selectedInstanceId),
    `Selected instance '${s.selectedInstanceId}' not in list: ${s.instances.map((i) => i.id).join(', ')}`,
  );
});

test('adapter detects Java correctly', () => {
  const s = loadState();
  assert.equal(s.java.ok, true);
  assert.match(s.java.path, /javaw?\.exe$/);
});
