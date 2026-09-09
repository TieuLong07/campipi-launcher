/**
 * Account management: IPC handlers for offline, microsoft, azauth flows.
 * Wired into main.ts to expose `launcher:accounts-*` channels via preload.
 */
import { ipcMain, shell, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import {
  addOfflineAccount, addAzauthAccount,
  listAccounts, getActiveAccount, setActiveAccount, removeAccount, renameAccount,
  getStorePathPublic,
} from './account-store';

let microsoftAuthWindow: BrowserWindow | null = null;
void microsoftAuthWindow;
// microsoftAuthResolver will be wired when real Azure app ID is available
// (PKCE flow + token exchange + Xbox Live + XSTS + Minecraft profile).
let _placeholder = 0;
void _placeholder;

/**
 * Called when an account is added / selected / renamed / removed.
 * main.ts wires this so the LAUNCHER:ACCOUNTS_SET_ACTIVE_FOR_LAUNCH channel
 * receives the right username+uuid at launch time.
 */
let onAccountChanged: (() => void) | null = null;
export function setOnAccountChanged(cb: (() => void) | null) {
  onAccountChanged = cb;
}

export function registerAccountHandlers() {
  ipcMain.handle('accounts:list', () => listAccounts());
  ipcMain.handle('accounts:active', () => getActiveAccount());
  ipcMain.handle('accounts:set-active', async (_e: IpcMainInvokeEvent, id: string) => {
    await setActiveAccount(id);
    if (onAccountChanged) onAccountChanged();
  });
  ipcMain.handle('accounts:remove', async (_e: IpcMainInvokeEvent, id: string) => {
    await removeAccount(id);
    if (onAccountChanged) onAccountChanged();
  });
  ipcMain.handle('accounts:rename', async (_e: IpcMainInvokeEvent, id: string, newName: string) => {
    await renameAccount(id, newName);
    if (onAccountChanged) onAccountChanged();
  });
  ipcMain.handle('accounts:add-offline', async (_e: IpcMainInvokeEvent, username: string) => {
    const a = await addOfflineAccount(username);
    // Auto-activate first account if no active one
    const active = await getActiveAccount();
    if (!active) {
      await setActiveAccount(a.id);
    }
    if (onAccountChanged) onAccountChanged();
    return a;
  });
  ipcMain.handle('accounts:add-microsoft', () => startMicrosoftAuth());
  ipcMain.handle('accounts:add-azauth', async (_e: IpcMainInvokeEvent, opts: { username: string; uuid: string; url: string; authSecret: string }) => {
    const a = await addAzauthAccount(opts);
    const active = await getActiveAccount();
    if (!active) {
      await setActiveAccount(a.id);
    }
    if (onAccountChanged) onAccountChanged();
    return a;
  });
  ipcMain.handle('accounts:store-path', () => getStorePathPublic());
}

/**
 * Launch Microsoft OAuth in an Electron BrowserWindow.
 * Real implementation requires:
 *   1. Azure app registration with redirect URI `http://localhost:PORT/callback`
 *   2. AZURE_CLIENT_ID env var or config
 *   3. Token exchange at /oauth2/v2.0/token
 *   4. Xbox Live + XSTS auth chain
 *   5. Minecraft access token via /services/minecraft/profile
 *
 * For now, this is a MOCK that opens a placeholder URL and returns null
 * after a short delay. The real flow will be wired when anh provides
 * the Azure client ID.
 */
async function startMicrosoftAuth(): Promise<{ username: string; uuid: string; accessToken: string; refreshToken: string; expiresInSec: number } | null> {
  const clientId = process.env.AZURE_CLIENT_ID;
  if (!clientId) {
    shell.openExternal('https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade');
    throw new Error('AZURE_CLIENT_ID chưa được cấu hình. Launcher sẽ mở Azure Portal — anh tạo app rồi cắm Client ID vào %APPDATA%/MCPubgLauncher/config.json hoặc env var AZURE_CLIENT_ID.');
  }
  // Real OAuth flow wires here once anh provides client_id.
  return null;
}
