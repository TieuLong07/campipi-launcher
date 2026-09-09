// Minimal type shim for `electron` so typecheck passes without the real package.
// We don't ship this to the renderer.
declare module 'electron' {
  export interface App {
    getPath(name: 'userData' | 'home' | 'appData' | 'cache' | 'temp'): string;
    on(event: string, listener: (...args: unknown[]) => void): void;
    whenReady(): Promise<void>;
    quit(): void;
  }
  export const app: App;
  export class BrowserWindow {
    constructor(opts?: Record<string, unknown>);
    loadURL(url: string): Promise<void>;
    loadFile(path: string): Promise<void>;
    close(): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    webContents: { openDevTools(opts?: unknown): void; send(channel: string, ...args: unknown[]): void };
    static getAllWindows(): BrowserWindow[];
  }
  export interface IpcMainInvokeEvent { sender: { send(channel: string, ...args: unknown[]): void } }
  export type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => any;
  export const ipcMain: {
    handle(channel: string, handler: IpcHandler): void;
    on(channel: string, listener: IpcHandler): void;
  };
  export interface IpcRendererEvent { sender: unknown }
  export const ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void;
    removeListener(channel: string, listener: (...args: any[]) => void): void;
  };
  export const contextBridge: {
    exposeInMainWorld(apiKey: string, api: unknown): void;
  };
  export const dialog: {
    showSaveDialog(window: BrowserWindow, opts: Record<string, unknown>): Promise<{ canceled: boolean; filePath?: string }>;
  };
  export const shell: {
    openPath(path: string): Promise<string>;
    openExternal(url: string): Promise<void>;
  };
}
