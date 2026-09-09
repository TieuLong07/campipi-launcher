/**
 * Shared types between main, preload, and renderer.
 * Renderer imports this via `@shared/types`. Main & preload import it via CommonJS require.
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Launcher {
  export type InstanceStatus = 'ready' | 'need-download' | 'broken' | 'empty' | 'update-available';
  export type AccountType = 'offline' | 'microsoft' | 'azauth';
  export type ToastType = 'success' | 'warn' | 'error' | 'info';

  export interface Instance {
    id: string;
    name: string;
    version: string;          // e.g. "1.20.1-forge-47.4.10"
    badge?: { label: string; kind: 'active' | 'neutral' };
    status: InstanceStatus;
    statusText: string;
    details: string[];
    actions: { id: string; label: string; variant?: 'primary' | 'danger' | 'default' }[];
  }

  export interface AppState {
    instances: Instance[];
    selectedInstanceId: string;
    java: { path: string; version: string; ok: boolean };
    launcherVersion: string;
    hasUpdate: boolean;
    ramMaxMb: number;
  }

  export interface LaunchRequest {
    instanceId: string;
    jvmArgs: string[];
  }

  export interface LogLine {
    ts: number;
    level: 'info' | 'warn' | 'error' | 'ok';
    stream: 'forge' | 'forge-err' | 'launcher' | 'network';
    text: string;
  }

  export interface IpcApi {
    getState(): Promise<AppState>;
    selectInstance(id: string): Promise<void>;
    triggerUpdateInstance(id: string): Promise<void>;
    openFolder(path: 'mods' | 'logs' | 'config' | 'root'): Promise<void>;
    openLogModal(): Promise<LogLine[]>;
    clearLog(): Promise<void>;
    saveLog(): Promise<string | null>;
    setRamMax(mb: number): Promise<void>;
    cleanCache(): Promise<{ freedBytes: number }>;
    cleanup(): Promise<{ removedFiles: number }>;
    checkLauncherUpdate(): Promise<{ hasUpdate: boolean; latest: string }>;
    launchInstance(req: LaunchRequest): Promise<{ ok: boolean; pid?: number; error?: string }>;
    killInstance(): Promise<void>;
    onLog(cb: (line: LogLine) => void): () => void;
    onLaunchState(cb: (state: 'idle' | 'launching' | 'running' | 'failed') => void): () => void;
  }
}
