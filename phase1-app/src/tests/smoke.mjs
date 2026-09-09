/**
 * Smoke test for the renderer DOM by parsing the built index.html and ensuring
 * every data-testid referenced in the components tree is present in the
 * final HTML/JS bundle. Run after `npm run build:renderer`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/renderer/assets/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('renderer build exists', () => {
  assert.ok(existsSync(DIST), `Renderer dist missing at ${DIST}. Run npm run build:renderer first.`);
  const js = readdirSync(DIST).filter((f) => f.endsWith('.js'));
  assert.ok(js.length > 0, 'No JS bundle produced');
});

test('bundle contains every required data-testid (static + dynamic templates)', () => {
  const files = readdirSync(DIST).filter((f) => f.endsWith('.js'));
  const bundle = files.map((f) => readFileSync(join(DIST, f), 'utf-8')).join('\n');
  const required = [
    'app-shell', 'loading', 'brand',
    'nav-home', 'nav-library', 'nav-settings', 'nav-badge-dot',
    'user-card', 'user-popover', 'popover-manage', 'popover-signout',
    'screen-home', 'hero', 'server-status', 'play-dock', 'instance-select', 'instance-meta', 'btn-play', 'play-text',
    'screen-library', 'instance-grid', 'add-instance',
    'screen-settings', 'setting-ram', 'ram-slider', 'ram-value', 'setting-java', 'java-status', 'setting-log', 'btn-open-log', 'setting-cache', 'btn-clean',
    'log-modal', 'btn-close-log', 'log-stream', 'btn-clear-log', 'btn-save-log', 'log-console',
    'toast', 'toast-msg',
  ];
  const missing = required.filter((id) => !bundle.includes(`data-testid":"${id}"`));
  assert.deepEqual(missing, [], `Missing static data-testids: ${missing.join(', ')}`);

  // Dynamic template strings (kept as backtick literals in bundle by Vite)
  const dynamic = [
    'instance-card-', 'badge-', 'status-', 'action-',
    'toast-icon-',
  ];
  const dynamicMissing = dynamic.filter((p) => !bundle.includes(`data-testid":\`${p}`));
  assert.deepEqual(dynamicMissing, [], `Missing dynamic data-testid templates: ${dynamicMissing.join(', ')}`);
});

test('bundle has zero emoji characters in source', () => {
  const srcFiles = [
    'src/renderer/components/App.tsx',
    'src/renderer/components/Sidebar.tsx',
    'src/renderer/components/HomeScreen.tsx',
    'src/renderer/components/LibraryScreen.tsx',
    'src/renderer/components/SettingsScreen.tsx',
    'src/renderer/components/LogModal.tsx',
    'src/renderer/components/Toast.tsx',
    'src/renderer/components/Icons.tsx',
  ];
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}]/u;
  for (const f of srcFiles) {
    const p = join(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), f);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, 'utf-8');
    const m = content.match(emojiRegex);
    assert.equal(m, null, `Emoji found in ${f}: ${m?.[0]}`);
  }
});
