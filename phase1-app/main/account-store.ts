/**
 * Account store: persist user accounts (offline, microsoft, azauth) in
 * `%APPDATA%/MCPubgLauncher/accounts.json` (Windows) or
 * `~/.config/MCPubgLauncher/accounts.json` (Linux/macOS).
 *
 * Offline accounts: deterministic UUID v3 from username (no network).
 * Microsoft accounts: OAuth token + refresh + profile (gamertag + uuid).
 * AZauth accounts: URL + auth secret for private server validation.
 */
import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

export type AccountType = 'offline' | 'microsoft' | 'azauth';

export interface Account {
  id: string;                // uuid (v4)
  type: AccountType;
  username: string;          // display name
  uuid: string;              // Minecraft player UUID
  createdAt: number;
  lastUsedAt: number;
  // Microsoft only
  msAccessToken?: string;
  msRefreshToken?: string;
  msExpiresAt?: number;
  // AZauth only
  azauthUrl?: string;
  azauthSecret?: string;
}

interface Store {
  version: 1;
  activeAccountId: string | null;
  accounts: Account[];
}

function getStorePath(): string {
  // In dev (tsx without electron), fall back to OS userData path.
  let base: string;
  try {
    base = app.getPath('userData');
  } catch {
    const home = process.env.APPDATA || process.env.HOME || '.';
    base = process.platform === 'win32' ? join(home, 'MCPubgLauncher') : join(home, '.config/MCPubgLauncher');
  }
  return join(base, 'accounts.json');
}

export function getStorePathPublic(): string { return getStorePath(); }

function offlineUuid(username: string): string {
  // Minecraft offline UUID is a v3 (MD5) UUID from the string "OfflinePlayer:<username>".
  const hash = createHash('md5').update(`OfflinePlayer:${username}`).digest();
  // Set version (4) and variant (2) bits per RFC 4122
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function randomUuid(): string {
  return randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

async function readStore(): Promise<Store> {
  const path = getStorePath();
  if (!existsSync(path)) return { version: 1, activeAccountId: null, accounts: [] };
  try {
    const text = await fs.readFile(path, 'utf-8');
    const parsed = JSON.parse(text) as Store;
    if (parsed.version !== 1) throw new Error(`Unknown store version: ${parsed.version}`);
    return parsed;
  } catch (e) {
    // Corrupted store — back up and start fresh.
    const backup = `${path}.corrupt.${Date.now()}.bak`;
    try { await fs.copyFile(path, backup); } catch {}
    return { version: 1, activeAccountId: null, accounts: [] };
  }
}

async function writeStore(store: Store): Promise<void> {
  const path = getStorePath();
  const dir = join(path, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Atomic write: temp file + rename.
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf-8');
  await fs.rename(tmp, path);
}

// ============ Public API ============

export async function listAccounts(): Promise<Account[]> {
  const s = await readStore();
  return s.accounts.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export async function getActiveAccount(): Promise<Account | null> {
  const s = await readStore();
  if (!s.activeAccountId) return null;
  return s.accounts.find((a) => a.id === s.activeAccountId) ?? null;
}

export async function addOfflineAccount(username: string): Promise<Account> {
  username = username.trim();
  if (!username || username.length > 16) throw new Error('Username phải từ 1-16 ký tự');
  if (!/^[A-Za-z0-9_]+$/.test(username)) throw new Error('Username chỉ chứa chữ, số, _');

  const s = await readStore();
  if (s.accounts.some((a) => a.type === 'offline' && a.username.toLowerCase() === username.toLowerCase())) {
    throw new Error(`Tài khoản offline "${username}" đã tồn tại`);
  }
  const account: Account = {
    id: randomUuid(),
    type: 'offline',
    username,
    uuid: offlineUuid(username),
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };
  s.accounts.push(account);
  s.activeAccountId ??= account.id;
  await writeStore(s);
  return account;
}

export async function addMicrosoftAccount(profile: { username: string; uuid: string; accessToken: string; refreshToken: string; expiresInSec: number }): Promise<Account> {
  const s = await readStore();
  if (s.accounts.some((a) => a.type === 'microsoft' && a.uuid === profile.uuid)) {
    throw new Error('Tài khoản Microsoft này đã được thêm');
  }
  const account: Account = {
    id: randomUuid(),
    type: 'microsoft',
    username: profile.username,
    uuid: profile.uuid,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    msAccessToken: profile.accessToken,
    msRefreshToken: profile.refreshToken,
    msExpiresAt: Date.now() + profile.expiresInSec * 1000,
  };
  s.accounts.push(account);
  s.activeAccountId ??= account.id;
  await writeStore(s);
  return account;
}

export async function addAzauthAccount(opts: { username: string; uuid: string; url: string; authSecret: string }): Promise<Account> {
  const s = await readStore();
  if (s.accounts.some((a) => a.type === 'azauth' && a.uuid === opts.uuid)) {
    throw new Error('Tài khoản AZauth này đã được thêm');
  }
  const account: Account = {
    id: randomUuid(),
    type: 'azauth',
    username: opts.username,
    uuid: opts.uuid,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    azauthUrl: opts.url,
    azauthSecret: opts.authSecret,
  };
  s.accounts.push(account);
  s.activeAccountId ??= account.id;
  await writeStore(s);
  return account;
}

export async function setActiveAccount(id: string): Promise<void> {
  const s = await readStore();
  const acc = s.accounts.find((a) => a.id === id);
  if (!acc) throw new Error(`Không tìm thấy tài khoản ${id}`);
  acc.lastUsedAt = Date.now();
  s.activeAccountId = id;
  await writeStore(s);
}

export async function removeAccount(id: string): Promise<void> {
  const s = await readStore();
  s.accounts = s.accounts.filter((a) => a.id !== id);
  if (s.activeAccountId === id) s.activeAccountId = s.accounts[0]?.id ?? null;
  await writeStore(s);
}

export async function renameAccount(id: string, newUsername: string): Promise<Account> {
  newUsername = newUsername.trim();
  if (!newUsername || newUsername.length > 16) throw new Error('Username phải từ 1-16 ký tự');
  if (!/^[A-Za-z0-9_]+$/.test(newUsername)) throw new Error('Username chỉ chứa chữ, số, _');

  const s = await readStore();
  const acc = s.accounts.find((a) => a.id === id);
  if (!acc) throw new Error(`Không tìm thấy tài khoản ${id}`);
  if (acc.type !== 'offline') throw new Error('Chỉ có thể đổi tên tài khoản offline');
  acc.username = newUsername;
  acc.uuid = offlineUuid(newUsername);
  await writeStore(s);
  return acc;
}
