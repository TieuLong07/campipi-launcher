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
  // Accounts
  accountsList: () => ipcRenderer.invoke(IPC.ACCOUNTS_LIST),
  accountsActive: () => ipcRenderer.invoke(IPC.ACCOUNTS_ACTIVE),
  accountsSetActive: (id) => ipcRenderer.invoke(IPC.ACCOUNTS_SET_ACTIVE, id),
  accountsRemove: (id) => ipcRenderer.invoke(IPC.ACCOUNTS_REMOVE, id),
  accountsRename: (id, name) => ipcRenderer.invoke(IPC.ACCOUNTS_RENAME, id, name),
  accountsAddOffline: (username) => ipcRenderer.invoke(IPC.ACCOUNTS_ADD_OFFLINE, username),
  accountsAddMicrosoft: () => ipcRenderer.invoke(IPC.ACCOUNTS_ADD_MICROSOFT),
  accountsAddAzauth: (opts) => ipcRenderer.invoke(IPC.ACCOUNTS_ADD_AZAUTH, opts),
  accountsStorePath: () => ipcRenderer.invoke(IPC.ACCOUNTS_STORE_PATH),
  getProxyStatus: () => ipcRenderer.invoke(IPC.PROXY_STATUS),
  restartProxy: () => ipcRenderer.invoke(IPC.PROXY_RESTART),
  stopProxy: () => ipcRenderer.invoke(IPC.PROXY_STOP),
  checkUpdate: () => ipcRenderer.invoke(IPC.CHECK_UPDATE),
  applyUpdate: () => ipcRenderer.invoke(IPC.APPLY_UPDATE),
  installCampipiu: () => ipcRenderer.invoke(IPC.INSTALL_CAMPIPIU),
};

contextBridge.exposeInMainWorld('launcher', api);
