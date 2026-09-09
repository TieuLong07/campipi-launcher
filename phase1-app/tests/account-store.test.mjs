/**
 * Test account-store with a temp directory (no Electron needed).
 * Verifies: add offline, list, set active, rename, remove, ms/azauth flows.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Module from 'node:module';

const tmpHome = mkdtempSync(join(tmpdir(), 'mcpubg-acct-'));
process.env.APPDATA = tmpHome;
process.env.HOME = tmpHome;
const userDataDir = join(tmpHome, 'userData');

// Monkey-patch require() so `import { app } from 'electron'` returns our stub.
// ESM uses a different mechanism (loadHooks) but tsx transpiles to CJS for .ts files,
// so patching Module._load works for the store's internal import.
const origLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'electron') return { app: { getPath: () => userDataDir } };
  return origLoad.call(this, req, parent, isMain);
};

let store;
before(async () => {
  store = await import('../src/main/account-store.ts');
});
after(() => {
  Module._load = origLoad;
  rmSync(tmpHome, { recursive: true, force: true });
});

test('addOfflineAccount creates a v3 UUID and persists', async () => {
  const acc = await store.addOfflineAccount('TestUser1');
  assert.equal(acc.type, 'offline');
  assert.equal(acc.username, 'TestUser1');
  assert.match(acc.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const file = join(tmpHome, 'userData/accounts.json');
  assert.ok(existsSync(file));
  const parsed = JSON.parse(readFileSync(file, 'utf-8'));
  assert.equal(parsed.accounts.length, 1);
  assert.equal(parsed.activeAccountId, acc.id);
});

test('addOfflineAccount rejects duplicate username (case-insensitive)', async () => {
  await assert.rejects(() => store.addOfflineAccount('TestUser1'), /đã tồn tại/);
  await assert.rejects(() => store.addOfflineAccount('testuser1'), /đã tồn tại/);
});

test('addOfflineAccount validates username format', async () => {
  await assert.rejects(() => store.addOfflineAccount('a b'), /chỉ chứa/);
  await assert.rejects(() => store.addOfflineAccount(''), /1-16/);
  await assert.rejects(() => store.addOfflineAccount('a'.repeat(17)), /1-16/);
  await store.addOfflineAccount('Player_2');
});

test('listAccounts returns accounts sorted by lastUsedAt desc', async () => {
  const list = await store.listAccounts();
  assert.equal(list.length, 2);
  assert.equal(list[0].username, 'Player_2');
  assert.equal(list[1].username, 'TestUser1');
});

test('setActiveAccount updates active + bumps lastUsedAt', async () => {
  const list = await store.listAccounts();
  const second = list[1];
  await store.setActiveAccount(second.id);
  const active = await store.getActiveAccount();
  assert.equal(active?.id, second.id);
});

test('renameAccount only works on offline accounts', async () => {
  const active = await store.getActiveAccount();
  assert.ok(active);
  const renamed = await store.renameAccount(active.id, 'Renamed_OK');
  assert.equal(renamed.username, 'Renamed_OK');
  assert.match(renamed.uuid, /^.{8}-/);
  await assert.rejects(() => store.renameAccount('fake-id', 'x'), /Không tìm thấy/);
});

test('addMicrosoftAccount stores tokens', async () => {
  const profile = { username: 'MSPlayer', uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', accessToken: 'at-123', refreshToken: 'rt-456', expiresInSec: 3600 };
  const acc = await store.addMicrosoftAccount(profile);
  assert.equal(acc.type, 'microsoft');
  assert.equal(acc.msAccessToken, 'at-123');
  // Active is still the offline account from earlier; list should now include ms
  const list = await store.listAccounts();
  assert.ok(list.find((a) => a.id === acc.id));
});

test('addMicrosoftAccount rejects duplicate uuid', async () => {
  const profile = { username: 'MSPlayer2', uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', accessToken: 'x', refreshToken: 'y', expiresInSec: 60 };
  await assert.rejects(() => store.addMicrosoftAccount(profile), /đã được thêm/);
});

test('addAzauthAccount stores url + secret', async () => {
  const acc = await store.addAzauthAccount({ username: 'azuser', uuid: '11111111-2222-3333-4444-555555555555', url: 'https://auth.local', authSecret: 'sekret' });
  assert.equal(acc.type, 'azauth');
  assert.equal(acc.azauthUrl, 'https://auth.local');
});

test('removeAccount deletes + reassigns active', async () => {
  const list = await store.listAccounts();
  const ms = list.find((a) => a.type === 'microsoft');
  assert.ok(ms);
  await store.removeAccount(ms.id);
  const after = await store.listAccounts();
  assert.equal(after.find((a) => a.id === ms.id), undefined);
  const active = await store.getActiveAccount();
  assert.ok(active);
  assert.notEqual(active.id, ms.id);
});

test('corrupt store is backed up and replaced with empty', async () => {
  const file = join(tmpHome, 'userData/accounts.json');
  writeFileSync(file, '{ not valid json');
  const fresh = await import('../src/main/account-store.ts?v=' + Date.now());
  const list = await fresh.listAccounts();
  assert.equal(list.length, 0);
  const backups = readdirSync(join(tmpHome, 'userData')).filter((f) => f.includes('corrupt'));
  assert.ok(backups.length > 0, 'corrupt backup not created');
});

test('renameAccount refuses for non-offline', async () => {
  // Add a microsoft account, then try to rename it
  const ms = await store.addMicrosoftAccount({ username: 'ms2', uuid: '22222222-3333-4444-5555-666666666666', accessToken: 't', refreshToken: 'r', expiresInSec: 60 });
  await assert.rejects(() => store.renameAccount(ms.id, 'NewName'), /Chỉ có thể đổi tên tài khoản offline/);
});
