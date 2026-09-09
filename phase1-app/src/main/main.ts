/**
 * Main Electron entry: wires up the window, IPC handlers, and the
 * main-process subsystems:
 *  - instance-adapter: reads .minecraft/ → AppState
 *  - account-store + account-handlers: offline/MS/AZauth
 *  - launcher-manager: spawn Java with the Forge command
 *  - proxy-manager: WebSocket proxy for mc.tiulong.site
 *  - repair: verify + fix runtime install
 */
import { app, BrowserWindow, ipcMain, shell, dialog, IpcMainInvokeEvent } from 'electron';
import { join } from 'node:path';  // Keep for join() calls
import * as path from 'node:path';  // For path.join()
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readState } from './instance-adapter';
import { IPC } from '../shared/ipc-channels';
import { registerAccountHandlers, setOnAccountChanged } from './account-handlers';
import { getActiveAccount } from './account-store';
import { launchInstance } from './launcher-manager';
import { ProxyManager } from './proxy-manager';
import { checkRuntime, cleanNativesDir, rotateLogs } from './repair';
import { ModUpdateChecker } from './mod-updater';
import type { Launcher } from '../shared/types';

// Use %APPDATA%/.minecraft (TLauncher-style: shared root, per-instance in versions/<name>/)
const RUNTIME_ROOT = path.join(app.getPath('appData'), '.minecraft');
const JAVA_PATH = 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/javaw.exe';
const JAVA_VERSION = '17.0.20';

let mainWindow: BrowserWindow | null = null;
let appState: Launcher.AppState | null = null;
let logBuffer: Launcher.LogLine[] = [];
const logListeners = new Set<(line: Launcher.LogLine) => void>();
const stateListeners = new Set<(s: 'idle' | 'launching' | 'running' | 'failed') => void>();
const proxyManager = new ProxyManager();
let modUpdateChecker = new ModUpdateChecker(RUNTIME_ROOT, 'cam');
let activeAccount: { username: string; uuid: string; userType: 'offline' | 'microsoft' | 'azauth' } | null = null;

function emit(line: Launcher.LogLine) {
  logBuffer.push(line);
  if (logBuffer.length > 1000) logBuffer = logBuffer.slice(-1000);
  for (const cb of logListeners) cb(line);
}

function setLaunchState(s: 'idle' | 'launching' | 'running' | 'failed') {
  for (const cb of stateListeners) cb(s);
}

function refreshState() {
  appState = readState(RUNTIME_ROOT, JAVA_PATH, JAVA_VERSION);
  // Sync modUpdateChecker to selected instance
  const selectedId = appState?.selectedInstanceId ?? 'cam';
  if (modUpdateChecker && (modUpdateChecker as any).instanceName !== selectedId) {
    modUpdateChecker = new ModUpdateChecker(RUNTIME_ROOT, selectedId);
  }
  return appState;
}

// ===== Window state persistence =====
interface WindowState { x: number; y: number; width: number; height: number; maximized: boolean }
const WINDOW_STATE_FILE = join(app.getPath('userData'), 'window-state.json');
function loadWindowState(): WindowState | null {
  try {
    if (existsSync(WINDOW_STATE_FILE)) {
      return JSON.parse(readFileSync(WINDOW_STATE_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
}
function saveWindowState(win: BrowserWindow): void {
  try {
    const w = win as any;
    const bounds = w.getBounds ? w.getBounds() : { x: 0, y: 0, width: 1180, height: 760 };
    const state: WindowState = {
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      maximized: w.isMaximized ? w.isMaximized() : false,
    };
    writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state), 'utf-8');
  } catch { /* ignore */ }
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';
  const saved = loadWindowState();
  mainWindow = new BrowserWindow({
    width: saved?.width ?? 1180,
    height: saved?.height ?? 760,
    x: saved?.x, y: saved?.y,
    minWidth: 980, minHeight: 640,
    backgroundColor: '#0c0b0a',
    title: 'MCPubg Launcher',
    autoHideMenuBar: true,
    show: false,  // show after first paint to avoid flash
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  if (saved?.maximized) (mainWindow as any).maximize();
  (mainWindow as any).once?.('ready-to-show', () => (mainWindow as any).show?.());
  // Persist on resize/move/close
  let saveTimer: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => mainWindow && saveWindowState(mainWindow), 500);
  };
  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);
  mainWindow.on('close', () => mainWindow && saveWindowState(mainWindow));
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  refreshState();
  registerAccountHandlers();
  setOnAccountChanged(async () => {
    const a = await getActiveAccount();
    activeAccount = a ? { username: a.username, uuid: a.uuid, userType: a.type } : null;
    emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: `Active account → ${a?.username ?? '(none)'} (${a?.type ?? '-'})` });
  });
  // Hydrate the in-memory launch account from the persisted store at boot
  // so a previously-selected account survives an app restart.
  try {
    const a = await getActiveAccount();
    if (a) activeAccount = { username: a.username, uuid: a.uuid, userType: a.type };
  } catch (e) { /* ignore */ }
  // Start the WebSocket proxy in the background so users can join without
  // extra clicks. Failures here should be non-fatal.
  proxyManager.start({ tcpPort: 25566, upstreamUrl: 'wss://mc.tiulong.site' })
    .then(() => emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: 'WS proxy started: 127.0.0.1:25566 → wss://mc.tiulong.site' }))
    .catch((err) => emit({ ts: Date.now(), level: 'warn', stream: 'launcher', text: `WS proxy failed: ${err.message}` }));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

const activeHandles = new Map<number, { stop: () => Promise<void> }>();
app.on('before-quit', async () => {
  for (const [, h] of activeHandles) {
    try { await h.stop(); } catch { /* ignore */ }
  }
  activeHandles.clear();
  await proxyManager.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC handlers =====
ipcMain.handle(IPC.GET_STATE, () => refreshState());
ipcMain.handle(IPC.SELECT_INSTANCE, (_e: IpcMainInvokeEvent, id: string) => {
  if (!appState) refreshState();
  appState!.selectedInstanceId = id;
  appState!.instances = appState!.instances.map(i => ({ ...i, badge: i.id === id ? { label: 'ĐANG CHỌN', kind: 'active' } : undefined }));
});
ipcMain.handle(IPC.UPDATE_INSTANCE, (_e, id: string) => {
  emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: `Bắt đầu cập nhật instance: ${id}` });
  setTimeout(() => emit({ ts: Date.now(), level: 'ok', stream: 'launcher', text: 'Cập nhật hoàn tất (mock)' }), 600);
  return Promise.resolve();
});
ipcMain.handle(IPC.OPEN_FOLDER, (_e, which: 'mods' | 'logs' | 'config' | 'root') => {
  const map: Record<typeof which, string> = {
    mods: join(RUNTIME_ROOT, 'mods'),
    logs: join(RUNTIME_ROOT, 'logs'),
    config: join(RUNTIME_ROOT, 'config'),
    root: RUNTIME_ROOT,
  };
  shell.openPath(map[which]);
});
ipcMain.handle(IPC.OPEN_LOG_MODAL, () => {
  if (logBuffer.length === 0) {
    emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: 'Log buffer initialized.' });
  }
  return [...logBuffer];
});
ipcMain.handle(IPC.CLEAR_LOG, () => { logBuffer = []; return Promise.resolve(); });
ipcMain.handle(IPC.SAVE_LOG, async () => {
  if (!mainWindow) return null;
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Lưu log launcher',
    defaultPath: `mcpubg-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`,
    filters: [{ name: 'Text', extensions: ['txt'] }],
  });
  if (res.canceled || !res.filePath) return null;
  const text = logBuffer.map(l => `[${new Date(l.ts).toISOString()}] [${l.level}] ${l.text}`).join('\n');
  await require('node:fs').promises.writeFile(res.filePath, text, 'utf-8');
  return res.filePath;
});
ipcMain.handle(IPC.SET_RAM, (_e, mb: number) => {
  if (!appState) refreshState();
  appState!.ramMaxMb = mb;
});
ipcMain.handle(IPC.CLEAN_CACHE, () => ({ freedBytes: 0 }));
ipcMain.handle(IPC.CLEANUP, () => ({ removedFiles: 0 }));

// ===== Phase 3B: Real launch =====
ipcMain.handle(IPC.LAUNCH, async (_e, opts: { instanceId?: string; version?: string; xmxMb?: number; xmsMb?: number; jvmArgs?: string[] }) => {
  // Renderer sends instanceId (e.g. "cam") — resolve to version folder name and gameDir
  const instanceId = opts?.instanceId ?? appState?.selectedInstanceId ?? 'cam';
  // For TLauncher-style, instanceId == version folder name (mods/saves isolated per instance)
  const version = opts?.version ?? instanceId;
  const xmxMb = opts?.xmxMb ?? appState?.ramMaxMb ?? 4096;
  const xmsMb = opts?.xmsMb ?? Math.max(1024, Math.floor(xmxMb / 2));
  setLaunchState('launching');
  emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: `Launching instance '${instanceId}' (${version}, RAM: ${xmxMb}M)...` });
  
  // Auto-minimize launcher when game starts (reduce performance impact)
  if (mainWindow) {
    mainWindow.minimize();
    emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: 'Launcher minimized to system tray' });
  }
  
  try {
    // Per-instance gameDir: versions/<instance>/ so saves/options/mods are isolated
    const instanceDir = join(RUNTIME_ROOT, 'versions', version);
    const handle = await launchInstance({
      runtimeRoot: RUNTIME_ROOT,
      version,
      gameDir: instanceDir,
      javaPath: JAVA_PATH,
      username: activeAccount?.username ?? 'TieuLong07',
      uuid: activeAccount?.uuid ?? 'f8e3d29e-fc4d-6198-2bec-111f52d98043',
      accessToken: 'offline-token',
      userType: activeAccount?.userType ?? 'offline',
      xmxMb,
      xmsMb,
      logFilePath: join(RUNTIME_ROOT, 'logs', `launch-${Date.now()}.log`),
      onLog: (line: any) => emit({ ts: Date.now(), level: line.level || 'info', stream: 'forge', text: line.text || line }),
      onError: (err: Error) => emit({ ts: Date.now(), level: 'error', stream: 'launcher', text: err.message }),
      useProxy: true, // Enable WebSocket proxy for server connection
    } as any);
    activeHandles.set(handle.pid!, { stop: handle.stop });
    setLaunchState('running');
    emit({ ts: Date.now(), level: 'ok', stream: 'launcher', text: `Minecraft started (pid: ${handle.pid})` });
    
    // Auto-restore launcher when game exits
    handle.wait().then(() => {
      if (mainWindow) {
        mainWindow.restore();
        mainWindow.focus();
        emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: 'Game exited, launcher restored' });
      }
    });
    
    return { ok: true, pid: handle.pid };
  } catch (err) {
    setLaunchState('failed');
    emit({ ts: Date.now(), level: 'error', stream: 'launcher', text: `Launch failed: ${(err as Error).message}` });
    // Restore launcher on error
    if (mainWindow) {
      mainWindow.restore();
      mainWindow.focus();
    }
    return { ok: false, error: (err as Error).message };
  }
});

ipcMain.handle(IPC.KILL, async () => {
  let killed = 0;
  for (const [pid, h] of activeHandles) {
    try { await h.stop(); activeHandles.delete(pid); killed++; } catch { /* ignore */ }
  }
  setLaunchState('idle');
  emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: `Đã dừng ${killed} process` });
});

// ===== Phase 3C: Proxy status =====
ipcMain.handle(IPC.PROXY_STATUS, () => proxyManager.getStats());
ipcMain.handle(IPC.PROXY_RESTART, async () => {
  await proxyManager.stop();
  return proxyManager.start();
});
ipcMain.handle(IPC.PROXY_STOP, async () => {
  await proxyManager.stop();
});

// ===== Mod Update Checker =====
ipcMain.handle(IPC.CHECK_UPDATE, async () => {
  try {
    const result = await modUpdateChecker.checkForUpdates();
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
});

ipcMain.handle(IPC.APPLY_UPDATE, async () => {
  try {
    await modUpdateChecker.applyUpdate((progress) => {
      const pct = progress.bytesTotal > 0 ? Math.round((progress.bytesDownloaded / progress.bytesTotal) * 100) : 0;
      emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: `Đang tải ${progress.filename} (${pct}%)...` });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
});

// ===== Phase 4: Repair =====
ipcMain.handle('LAUNCHER:REPAIR_CHECK', () => checkRuntime({ runtimeRoot: RUNTIME_ROOT, version: '1.20.1-forge-47.4.10' }));
ipcMain.handle('LAUNCHER:REPAIR_FIX', (_e, action: string) => {
  switch (action) {
    case 'rotate-logs': {
      const n = rotateLogs(join(RUNTIME_ROOT, 'logs'), 10);
      emit({ ts: Date.now(), level: 'ok', stream: 'launcher', text: `Đã xoay vòng log: xoá ${n} file cũ` });
      return { ok: true, removed: n };
    }
    case 'clean-natives': {
      const nativesDir = join(RUNTIME_ROOT, 'versions', '1.20.1-forge-47.4.10', '1.20.1-forge-47.4.10-natives');
      const n = cleanNativesDir(nativesDir);
      emit({ ts: Date.now(), level: 'ok', stream: 'launcher', text: `Đã dọn natives: xoá ${n} file` });
      return { ok: true, removed: n };
    }
    default:
      return { ok: false, error: `Unknown action: ${action}` };
  }
});

// ===== Account =====
ipcMain.handle('LAUNCHER:ACCOUNTS_SET_ACTIVE_FOR_LAUNCH', (_e, account: { username: string; uuid: string; userType: 'offline' | 'microsoft' | 'azauth' }) => {
  activeAccount = account;
  emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: `Đã chọn tài khoản: ${account.username} (${account.userType})` });
});

// Push channels
ipcMain.on(IPC.ON_LOG, (e) => {
  e.sender.send('launcher:log-attached');
});
ipcMain.on(IPC.ON_STATE, () => { /* placeholder */ });
