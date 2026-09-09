import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { join } from 'node:path';
import { readState } from './instance-adapter';
import { IPC } from '../shared/ipc-channels';
import type { Launcher } from '../shared/types';

const RUNTIME_ROOT = 'D:/2026WORK/MCPubgLauncherV2/.runtime/clean';
const JAVA_PATH = 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot/bin/javaw.exe';

let mainWindow: BrowserWindow | null = null;
let appState: Launcher.AppState | null = null;
let logBuffer: Launcher.LogLine[] = [];
const logListeners = new Set<(line: Launcher.LogLine) => void>();
const stateListeners = new Set<(s: 'idle' | 'launching' | 'running' | 'failed') => void>();

function emit(line: Launcher.LogLine) {
  logBuffer.push(line);
  if (logBuffer.length > 1000) logBuffer = logBuffer.slice(-1000);
  for (const cb of logListeners) cb(line);
}

function setLaunchState(s: 'idle' | 'launching' | 'running' | 'failed') {
  for (const cb of stateListeners) cb(s);
}

function refreshState() {
  appState = readState(RUNTIME_ROOT, JAVA_PATH, '17.0.20');
  return appState;
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0c0b0a',
    title: 'MCPubg Launcher',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  refreshState();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC handlers =====
ipcMain.handle(IPC.GET_STATE, () => refreshState());
ipcMain.handle(IPC.SELECT_INSTANCE, (_e, id: string) => {
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
ipcMain.handle(IPC.CLEAR_LOG, () => {
  logBuffer = [];
  return Promise.resolve();
});
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
ipcMain.handle(IPC.CHECK_UPDATE, () => ({ hasUpdate: false, latest: '0.0.2-alpha' }));
ipcMain.handle(IPC.LAUNCH, () => {
  setLaunchState('launching');
  emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: 'Launch requested (Phase 1 mock — real launch wires up in Phase 3).' });
  setTimeout(() => {
    setLaunchState('failed');
    emit({ ts: Date.now(), level: 'warn', stream: 'launcher', text: 'Phase 1: chưa wire thật vào engine. Xem Phase 0 evidence ở docs/evidence/phase-0/REPORT.md.' });
  }, 800);
  return { ok: false, error: 'Phase 1 mock — real launch wires up in Phase 3' };
});
ipcMain.handle(IPC.KILL, () => {
  setLaunchState('idle');
  emit({ ts: Date.now(), level: 'info', stream: 'launcher', text: 'Launch cancelled.' });
});

// Push channels (separate from invoke)
ipcMain.on(IPC.ON_LOG, (e) => {
  const cb = (_l: Launcher.LogLine) => {};
  logListeners.add(cb);
  e.sender.send('launcher:log-attached');
});
ipcMain.on(IPC.ON_STATE, () => { /* placeholder */ });
