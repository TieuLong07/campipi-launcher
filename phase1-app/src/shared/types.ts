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
    modsCount?: number;       // number of .jar mods in instance
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

  export interface Account {
    id: string;
    type: AccountType;
    username: string;
    uuid: string;
    createdAt: number;
    lastUsedAt: number;
    msAccessToken?: string;
    msRefreshToken?: string;
    msExpiresAt?: number;
    azauthUrl?: string;
    azauthSecret?: string;
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
    // Accounts (Phase 2A)
    accountsList(): Promise<Account[]>;
    accountsActive(): Promise<Account | null>;
    accountsSetActive(id: string): Promise<void>;
    accountsRemove(id: string): Promise<void>;
    accountsRename(id: string, newName: string): Promise<Account>;
    accountsAddOffline(username: string): Promise<Account>;
    accountsAddMicrosoft(): Promise<{ username: string; uuid: string; accessToken: string; refreshToken: string; expiresInSec: number } | null>;
    accountsAddAzauth(opts: { username: string; uuid: string; url: string; authSecret: string }): Promise<Account>;
    accountsStorePath(): Promise<string>;
    // Proxy
    getProxyStatus(): Promise<{ running: boolean; upstream: string; tcpPort: number; bytesUp: number; bytesDown: number; clients: number }>;
    restartProxy(): Promise<void>;
    stopProxy(): Promise<void>;
    // Mod Updates
    checkUpdate(): Promise<{ ok: boolean; hasUpdate?: boolean; latestVersion?: string; modsToAdd?: { filename: string; size: number }[]; modsToUpdate?: { filename: string; size: number }[]; modsToRemove?: string[]; totalSize?: number; error?: string }>;
    applyUpdate(): Promise<{ ok: boolean; error?: string }>;
  }
}
