/**
 * E2E walkthrough for the renderer build (dist/renderer/index.html).
 * Opens Chromium headless, walks through Home / Library / Settings,
 * captures screenshots, asserts critical data-testid, bakes evidence.
 *
 * Run:  npx tsx tests/walkthrough.mjs
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(HERE, '..');
const DIST_DIR = join(ROOT, 'dist/renderer');
const DIST_INDEX = join(DIST_DIR, 'index.html');
const OUT = join(ROOT, '../docs/evidence/phase-1.5');

if (!existsSync(DIST_INDEX)) {
  console.error(`Renderer not built. Run \`npx vite build\` first. Missing: ${DIST_INDEX}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// Tiny static server so the renderer can load its assets without CORS issues
// (Chromium blocks file:// cross-origin).
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const url = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const safe = url.replace(/\.\./g, '').replace(/\/+/g, '/');
    const file = join(DIST_DIR, safe);
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404).end(String(e));
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/index.html`;
console.log(`Static server: ${url}`);

const issues = [];
function issue(kind, msg, ctx) {
  issues.push({ kind, msg, ctx });
  console.log(`  ⚠ ${kind}: ${msg}${ctx ? ' (' + ctx + ')' : ''}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});

// Mock the preload-exposed `window.launcher` API so the static HTML build
// can run in plain Chromium (no Electron). In production this is provided by
// preload.ts via contextBridge.
await context.addInitScript(() => {
  const noop = async () => undefined;
  const mockState = {
    instances: [
      { id: '1.20.1-forge-47.4.10', name: '1.20.1 Forge 47.4.10', version: '1.20.1-forge-47.4.10',
        badge: { label: 'ĐANG CHỌN', kind: 'active' },
        status: 'ready', statusText: 'Sẵn sàng vào game',
        details: ['• 49 Mods hoạt động (TACZ, GeckoLib, Citadel)', '• Đã tích hợp gói Resource Pack PUBG'],
        actions: [{ id: 'update', label: 'Cập nhật v0.0.3' }, { id: 'verify', label: 'Sửa lỗi' }] },
      { id: '1.20.1', name: '1.20.1', version: '1.20.1',
        badge: { label: 'CHƯA CÀI', kind: 'neutral' },
        status: 'empty', statusText: 'Chưa cài đặt',
        details: ['• Minecraft gốc, không Forge', '• Dùng để test chẩn đoán'],
        actions: [{ id: 'select', label: 'Kích hoạt' }, { id: 'open-folder', label: 'Mở Folder' }] },
    ],
    selectedInstanceId: '1.20.1-forge-47.4.10',
    java: { path: 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/javaw.exe', version: '17.0.20', ok: true },
    launcherVersion: '0.0.2-alpha',
    hasUpdate: true,
    ramMaxMb: 4096,
  };
  let state = JSON.parse(JSON.stringify(mockState));
  let accounts = [
    { id: 'a1', type: 'offline', username: 'TieuLong07', uuid: 'f8e3d29e-fc4d-6198-2bec-111f52d98043', createdAt: Date.now() - 1000, lastUsedAt: Date.now() },
  ];
  let activeId = 'a1';
  const listeners = { log: [], state: [] };
  const api = {
    getState: async () => JSON.parse(JSON.stringify(state)),
    selectInstance: async (id) => { state.selectedInstanceId = id; state.instances = state.instances.map(i => ({ ...i, badge: i.id === id ? { label: 'ĐANG CHỌN', kind: 'active' } : undefined })); },
    triggerUpdateInstance: async () => undefined,
    openFolder: noop,
    openLogModal: async () => [],
    clearLog: noop,
    saveLog: async () => null,
    setRamMax: async (mb) => { state.ramMaxMb = mb; },
    cleanCache: async () => ({ freedBytes: 0 }),
    cleanup: async () => ({ removedFiles: 0 }),
    checkLauncherUpdate: async () => ({ hasUpdate: false, latest: '0.0.2-alpha' }),
    launchInstance: async () => ({ ok: true, pid: 12345 }),
    killInstance: noop,
    onLog: (cb) => { listeners.log.push(cb); return () => { listeners.log = listeners.log.filter(x => x !== cb); }; },
    onLaunchState: (cb) => { listeners.state.push(cb); return () => { listeners.state = listeners.state.filter(x => x !== cb); }; },
    // Accounts
    accountsList: async () => accounts.slice(),
    accountsActive: async () => accounts.find(a => a.id === activeId) ?? null,
    accountsSetActive: async (id) => { activeId = id; },
    accountsRemove: async (id) => { accounts = accounts.filter(a => a.id !== id); if (activeId === id) activeId = accounts[0]?.id ?? null; },
    accountsRename: async (id, name) => { const a = accounts.find(x => x.id === id); if (a) a.username = name; return a; },
    accountsAddOffline: async (name) => { const a = { id: 'a' + Date.now(), type: 'offline', username: name, uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', createdAt: Date.now(), lastUsedAt: Date.now() }; accounts.push(a); return a; },
    accountsAddMicrosoft: async () => { throw new Error('AZURE_CLIENT_ID chưa được cấu hình'); },
    accountsAddAzauth: async (opts) => { const a = { id: 'a' + Date.now(), type: 'azauth', username: opts.username, uuid: opts.uuid, createdAt: Date.now(), lastUsedAt: Date.now(), azauthUrl: opts.url, azauthSecret: opts.authSecret }; accounts.push(a); return a; },
    accountsStorePath: async () => 'C:\\Users\\ADMIN\\AppData\\Roaming\\MCPubgLauncher\\accounts.json',
  };
  Object.defineProperty(window, 'launcher', { value: api, writable: false, configurable: false });
});

const page = await context.newPage();

const consoleErrors = [];
const networkErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('response', (res) => {
  const status = res.status();
  const url = res.url();
  if (status >= 400 && !url.startsWith('data:')) {
    networkErrors.push(`${status} ${url}`);
  }
});

console.log('1) Loading renderer HTML...');
page.on('pageerror', (err) => console.log('  PAGE ERR:', err.message));
page.on('console', (msg) => { if (msg.type() === 'error') console.log('  CONSOLE error:', msg.text()); });
await page.goto(url);
await page.waitForSelector('[data-testid="app-shell"]', { timeout: 10000 });
await page.waitForTimeout(800);

console.log('2) Home tab — checking core elements...');
const homeChecks = {
  brand: await page.locator('[data-testid="brand"]').count(),
  hero: await page.locator('[data-testid="hero"]').count(),
  serverStatus: await page.locator('[data-testid="server-status"]').count(),
  playDock: await page.locator('[data-testid="play-dock"]').count(),
  playBtn: await page.locator('[data-testid="btn-play"]').count(),
  instanceSelect: await page.locator('[data-testid="instance-select"]').count(),
};
for (const [k, v] of Object.entries(homeChecks)) {
  if (v === 0) issue('missing', `Home.${k} not found`);
}
await page.screenshot({ path: join(OUT, '01-home.png'), fullPage: false });
console.log('   screenshot: 01-home.png');

console.log('3) Library tab...');
await page.locator('[data-testid="nav-library"]').click();
await page.waitForTimeout(500);
const libChecks = {
  grid: await page.locator('[data-testid="instance-grid"]').count(),
  cam: await page.locator('[data-testid="instance-card-1.20.1-forge-47.4.10"]').count(),
  vanilla: await page.locator('[data-testid="instance-card-1.20.1"]').count(),
  statusCam: await page.locator('[data-testid="status-1.20.1-forge-47.4.10"]').count(),
  addBtn: await page.locator('[data-testid="add-instance"]').count(),
};
for (const [k, v] of Object.entries(libChecks)) {
  if (v === 0) issue('missing', `Library.${k} not found`);
}
await page.screenshot({ path: join(OUT, '02-library.png'), fullPage: false });
console.log('   screenshot: 02-library.png');

console.log('4) Settings tab...');
await page.locator('[data-testid="nav-settings"]').click();
await page.waitForTimeout(500);
const settingsChecks = {
  screen: await page.locator('[data-testid="screen-settings"]').count(),
  ram: await page.locator('[data-testid="setting-ram"]').count(),
  java: await page.locator('[data-testid="setting-java"]').count(),
  log: await page.locator('[data-testid="setting-log"]').count(),
  cache: await page.locator('[data-testid="setting-cache"]').count(),
  javaOk: (await page.locator('[data-testid="java-status"]').textContent())?.trim(),
};
for (const [k, v] of Object.entries(settingsChecks)) {
  if (k === 'javaOk') continue;
  if (v === 0) issue('missing', `Settings.${k} not found`);
}
if (settingsChecks.javaOk && !settingsChecks.javaOk.includes('17')) {
  issue('value', `Java status: ${settingsChecks.javaOk}`);
}
await page.screenshot({ path: join(OUT, '03-settings.png'), fullPage: false });
console.log('   screenshot: 03-settings.png');

console.log('5) Open log modal...');
await page.locator('[data-testid="btn-open-log"]').click();
await page.waitForTimeout(400);
const logModal = await page.locator('[data-testid="log-modal"]').count();
if (logModal === 0) issue('interaction', 'Log modal did not open');
await page.screenshot({ path: join(OUT, '04-log-modal.png'), fullPage: false });
console.log('   screenshot: 04-log-modal.png');
await page.locator('[data-testid="btn-close-log"]').click();
await page.waitForTimeout(300);

console.log('6) Back to home — toast test...');
await page.locator('[data-testid="nav-home"]').click();
await page.waitForTimeout(300);
// Trigger a toast by clicking an action button (use a Library card, switch back)
await page.locator('[data-testid="nav-library"]').click();
await page.waitForTimeout(300);
const verifyBtn = page.locator('[data-testid="action-1.20.1-forge-47.4.10-verify"]');
if (await verifyBtn.count() > 0) {
  await verifyBtn.click();
  await page.waitForTimeout(300);
  const toast = await page.locator('[data-testid="toast"]').count();
  if (toast === 0) issue('interaction', 'Toast did not appear after click');
  await page.screenshot({ path: join(OUT, '05-toast.png'), fullPage: false });
  console.log('   screenshot: 05-toast.png');
}

console.log('7) Sidebar nav badge dot...');
const badge = await page.locator('[data-testid="nav-badge-dot"]').count();
if (badge === 0) issue('missing', 'Nav badge dot not rendered');

console.log('8) User popover + account modal...');
await page.locator('[data-testid="user-card"]').click();
await page.waitForTimeout(300);
const popoverItems = await page.locator('[data-testid="user-popover"] [data-testid]').count();
if (popoverItems < 1) issue('interaction', 'User popover has no items');
// Should have at least "Quản lý tài khoản" (data-testid="popover-manage")
const manageBtn = await page.locator('[data-testid="popover-manage"]').count();
if (manageBtn === 0) issue('missing', 'popover-manage button not found');

// Open account modal
await page.locator('[data-testid="popover-manage"]').click();
await page.waitForTimeout(400);
const accModal = await page.locator('[data-testid="account-modal"]').count();
if (accModal === 0) issue('interaction', 'Account modal did not open');
const accRow = await page.locator('[data-testid^="account-row-"]').count();
if (accRow === 0) issue('missing', 'Account list empty');
await page.screenshot({ path: join(OUT, '07-account-modal.png'), fullPage: false });
console.log('   screenshot: 07-account-modal.png');
await page.locator('[data-testid="account-modal-close"]').click();
await page.waitForTimeout(200);

await browser.close();

console.log('\\n=== Summary ===');
console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 5).forEach((e) => console.log('  !', e));
console.log(`Network 4xx/5xx: ${networkErrors.length}`);
networkErrors.slice(0, 5).forEach((e) => console.log('  !', e));
console.log(`Logic issues:    ${issues.length}`);
issues.forEach((i) => console.log(`  ! ${i.kind}: ${i.msg}`));

const report = {
  date: new Date().toISOString(),
  rendererUrl: url,
  consoleErrors,
  networkErrors,
  issues,
  screenshots: [
    '01-home.png', '02-library.png', '03-settings.png',
    '04-log-modal.png', '05-toast.png', '06-user-popover.png',
    '07-account-modal.png',
  ],
  pass: consoleErrors.length === 0 && networkErrors.length === 0 && issues.length === 0,
};
writeFileSync(join(OUT, 'walkthrough.json'), JSON.stringify(report, null, 2));
console.log(`\nResult: ${report.pass ? '✅ PASS' : '❌ FAIL'} — see ${OUT}/walkthrough.json`);
server.close();
process.exit(report.pass ? 0 : 1);
