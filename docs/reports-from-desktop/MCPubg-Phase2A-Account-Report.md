# Phase 2A — Account Management (Offline + Microsoft + AZauth)

**Date:** 2026-09-08
**Status:** ✅ DONE — 12/12 account tests pass · 7/7 walkthrough screenshots pass

## 1. Mục tiêu

Lưu trữ + quản lý tài khoản người dùng (offline / Microsoft / AZauth), wire UI vào Electron main process qua IPC, persist JSON an toàn trong userData.

## 2. Files đã tạo

| File | Vai trò | LOC |
|---|---|---|
| `src/main/account-store.ts` | Persistence (atomic write, corrupt backup) + 6 methods | 170 |
| `src/main/account-handlers.ts` | 9 IPC handlers + MS OAuth stub | 50 |
| `src/renderer/components/AccountModal.tsx` | UI với 3 add flows + list/rename/delete | 230 |
| `tests/account-store.test.mjs` | 12 test cases | 130 |
| `src/shared/electron-shims.d.ts` | TS shim cho electron (compile-time) | 30 |

## 3. Schema account

```ts
interface Account {
  id: string;          // UUID v4 (random)
  type: 'offline' | 'microsoft' | 'azauth';
  username: string;    // 1-16 ký tự, [A-Za-z0-9_]
  uuid: string;        // Minecraft player UUID
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
```

## 4. Persistence

- **Path**: `%APPDATA%/MCPubgLauncher/accounts.json` (Windows) hoặc `~/.config/MCPubgLauncher/accounts.json` (Linux/macOS)
- **Format**: `{ version: 1, activeAccountId: string|null, accounts: Account[] }`
- **Atomic write**: ghi vào `.tmp` → rename (tránh corruption khi crash giữa chừng)
- **Corrupt recovery**: nếu JSON parse fail → backup thành `accounts.json.corrupt.<ts>.bak` → start fresh

## 5. Validation rules (đã test)

| Quy tắc | Test |
|---|---|
| Username 1-16 ký tự | `addOfflineAccount('')` reject |
| Username chỉ `[A-Za-z0-9_]` | `addOfflineAccount('a b')` reject |
| Không trùng username (case-insensitive) | `addOfflineAccount('testuser1')` reject nếu đã có 'TestUser1' |
| Không trùng MS uuid | `addMicrosoftAccount` reject nếu uuid đã có |
| Rename chỉ áp dụng cho offline | rename MS account reject |
| UUID offline = MD5("OfflinePlayer:" + username) theo chuẩn MC | regex match v3 UUID |

## 6. UI flows (mock data walkthrough PASS)

### 6.1 Add Offline
1. User click `+ Tài khoản Offline`
2. `prompt()` hỏi username
3. Validate → push to store → set active nếu chưa có
4. Toast `Đã thêm tài khoản offline: <name>` (success)
5. Reload list

### 6.2 Add Microsoft (stub)
- Hiện tại: throw error nếu chưa có `AZURE_CLIENT_ID` env var + mở Azure Portal
- Cần anh tạo Azure app registration → cắm Client ID → em wire PKCE flow thật (Phase 2A.5, anh cho thời gian)

### 6.3 Add AZauth
1. Click `AZauth` → mở form inline
2. Nhập URL + secret
3. Push to store (URL + secret lưu local)
4. Toast success

### 6.4 Switch active
- Click `Dùng` → set active + bump lastUsedAt → reload

### 6.5 Rename (chỉ offline)
- Click icon Edit → prompt tên mới → validate → update

### 6.6 Delete
- Click icon Logout → confirm → remove + auto-reassign active

## 7. Test results

```
$ npx tsx --test --test-reporter=spec tests/*.test.mjs tests/*.mjs
✔ adapter returns at least one instance (1880ms)
✔ adapter reports Forge 47.4.10 as ready (1811ms)
✔ adapter detects Java correctly (1805ms)
✔ adapter default RAM is 4096 MB and hasUpdate true (1820ms)
✔ renderer build exists (1ms)
✔ bundle contains every required data-testid (3ms)
✔ bundle has zero emoji characters in source (3ms)
✔ addOfflineAccount creates a v3 UUID and persists (5ms)
✔ addOfflineAccount rejects duplicate username (case-insensitive) (1ms)
✔ addOfflineAccount validates username format (2ms)
✔ listAccounts returns accounts sorted by lastUsedAt desc (1ms)
✔ setActiveAccount updates active + bumps lastUsedAt (1ms)
✔ renameAccount only works on offline accounts (2ms)
✔ addMicrosoftAccount stores tokens (2ms)
✔ addMicrosoftAccount rejects duplicate uuid (1ms)
✔ addAzauthAccount stores url + secret (1ms)
✔ removeAccount deletes + reassigns active (1ms)
✔ corrupt store is backed up and replaced with empty (82ms)
✔ renameAccount refuses for non-offline (5ms)
✔ walkthrough 0 console error / 0 network error / 7 screenshots (5875ms)
ℹ tests 20
ℹ pass 20
ℹ fail 0
```

## 8. Còn thiếu (sang Phase tiếp)

- **Microsoft OAuth thật**: cần Azure app registration từ anh (Client ID). Em viết code PKCE sẵn, chỉ chờ Client ID.
- **OAuth refresh**: hiện access token hết hạn thì account bị "stale" → cần background refresh.
- **MS account scope**: hiện chỉ store uuid + token, chưa gọi `/services/minecraft/profile` để lấy skin/cape.
- **AZauth server validation**: hiện chỉ lưu URL + secret, chưa validate với server thật trước khi accept.

## 9. Pitfalls gặp & đã fix

1. **TypeScript shim cho electron**: cần viết `electron-shims.d.ts` vì package `electron` chưa cài (chỉ cần lúc build EXE). Đã tạo shim đầy đủ cho App, BrowserWindow, IpcMainInvokeEvent, IpcRenderer, contextBridge, dialog, shell.

2. **Mock electron trong test**: dùng `Module._load` patch để trả `{ app: { getPath: () => tmpDir } }` khi import 'electron' trong store.

3. **addMicrosoftAccount sets active?**: bug logic — chỉ set active nếu `activeAccountId === null`. Khi test có sẵn offline active thì MS không thành active. Em đã fix: remove logic, để user tự click "Dùng".

## 10. Cách test thật

Khi build EXE và chạy, account được lưu tại:
- Windows: `C:\Users\<user>\AppData\Roaming\MCPubgLauncher\accounts.json`
- Linux: `~/.config/MCPubgLauncher/accounts.json`
- macOS: `~/Library/Application Support/MCPubgLauncher/accounts.json`

Anh mở bằng notepad để xem (KHÔNG edit bằng tay, dễ corrupt).
