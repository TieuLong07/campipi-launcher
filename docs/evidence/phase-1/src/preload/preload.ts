import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type { Launcher } from '../shared/types';

const api: Launcher.IpcApi = {
  getState: () => ipcRenderer.invoke(IPC.GET_STATE),
  selectInstance: (id) => ipcRenderer.invoke(IPC.SELECT_INSTANCE, id),
  triggerUpdateInstance: (id) => ipcRenderer.invoke(IPC.UPDATE_INSTANCE, id),
  openFolder: (p) => ipcRenderer.invoke(IPC.OPEN_FOLDER, p),
  openLogModal: () => ipcRenderer.invoke(IPC.OPEN_LOG_MODAL),
  clearLog: () => ipcRenderer.invoke(IPC.CLEAR_LOG),
  saveLog: () => ipcRenderer.invoke(IPC.SAVE_LOG),
  setRamMax: (mb) => ipcRenderer.invoke(IPC.SET_RAM, mb),
  cleanCache: () => ipcRenderer.invoke(IPC.CLEAN_CACHE),
  cleanup: () => ipcRenderer.invoke(IPC.CLEANUP),
  checkLauncherUpdate: () => ipcRenderer.invoke(IPC.CHECK_UPDATE),
  launchInstance: (req) => ipcRenderer.invoke(IPC.LAUNCH, req),
  killInstance: () => ipcRenderer.invoke(IPC.KILL),
  onLog: (cb) => {
    const handler = (_e: unknown, line: Launcher.LogLine) => cb(line);
    ipcRenderer.on(IPC.ON_LOG, handler);
    return () => ipcRenderer.removeListener(IPC.ON_LOG, handler);
  },
  onLaunchState: (cb) => {
    const handler = (_e: unknown, state: 'idle' | 'launching' | 'running' | 'failed') => cb(state);
    ipcRenderer.on(IPC.ON_STATE, handler);
    return () => ipcRenderer.removeListener(IPC.ON_STATE, handler);
  },
};

contextBridge.exposeInMainWorld('launcher', api);
