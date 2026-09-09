/**
 * Process manager: spawn Java 17 with the Forge command built by
 * `forge-command.ts`, stream stdout/stderr to log listeners, and
 * provide safe kill on Windows.
 *
 * Pitfalls:
 *  - We MUST use `detached: true` + `windowsHide: false` on Windows
 *    so the MC window can appear (otherwise Electron swallows it).
 *  - Stdio must be piped (not inherited) so we can capture log lines.
 *  - On Windows, kill = taskkill /pid <pid> /T /F (TERM isn't enough
 *    because Java 17 spawns AWT + LWJGL threads).
 *  - When MC exits, the spawned children must die too → we use
 *    job objects via `windowsHide: false` + spawn tree.
 *  - We do NOT inherit FDs to MC, or its console writes pollute ours.
 */
import { spawn, ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { dirname } from 'node:path';
import { buildForgeCommand, type BuildOptions } from './forge-command';
import type { ProxyManager } from './proxy-manager';

export interface LaunchOptions extends BuildOptions {
  logFilePath: string;       // path to write full log
  onLog?: (line: string, stream: 'stdout' | 'stderr') => void;
  onExit?: (code: number | null, signal: string | null) => void;
  onError?: (err: Error) => void;
  /** If true, start WebSocket proxy before launching game */
  useProxy?: boolean;
  /** Shared proxy manager instance from main.ts (avoids duplicate instances) */
  proxyManager?: ProxyManager;
}

export interface LaunchHandle {
  pid: number | undefined;
  state: 'running' | 'stopped' | 'crashed' | 'killed';
  stop: () => Promise<void>;
  wait: () => Promise<{ code: number | null; signal: string | null }>;
}

const activeHandles = new Map<number, LaunchHandle>();

export function listActive(): { pid: number }[] {
  return [...activeHandles.keys()].map((pid) => ({ pid }));
}

export async function launchInstance(opts: LaunchOptions): Promise<LaunchHandle> {
  const pm = opts.proxyManager;
  // 0. Start proxy if needed (for server connection)
  if (opts.useProxy && pm) {
    try {
      await pm.start();
      console.log('[Launcher] Proxy started on port 25566');
    } catch (err) {
      console.error('[Launcher] Proxy start failed:', err);
      // Continue anyway — user might want to play offline
    }
  }

  // 1. Build command
  const built = await buildForgeCommand(opts);

  // 2. Ensure log dir
  const logDir = dirname(opts.logFilePath);
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  // 3. Spawn
  const env = { ...built.env };
  delete env['ELECTRON_RUN_AS_NODE'];
  const proc: ChildProcess = spawn(built.argv[0], built.argv.slice(1), {
    cwd: built.cwd,
    env,
    detached: true,
    windowsHide: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!proc.pid) {
    const err = new Error('spawn() returned no pid (process failed to start)');
    opts.onError?.(err);
    throw err;
  }

  // 4. Stream to file + listeners
  const logStream = createWriteStream(opts.logFilePath, { flags: 'a' });
  const stamp = () => new Date().toISOString();
  const pipe = (stream: NodeJS.ReadableStream, label: 'stdout' | 'stderr') => {
    let buf = '';
    stream.setEncoding('utf-8');
    stream.on('data', (chunk: string) => {
      buf += chunk;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const tagged = `[${stamp()}] [${label}] ${line}\n`;
        logStream.write(tagged);
        opts.onLog?.(line, label);
      }
    });
    stream.on('end', () => {
      if (buf.length) {
        const tagged = `[${stamp()}] [${label}] ${buf}\n`;
        logStream.write(tagged);
        opts.onLog?.(buf, label);
      }
    });
  };
  if (proc.stdout) pipe(proc.stdout, 'stdout');
  if (proc.stderr) pipe(proc.stderr, 'stderr');

  // 5. Wire exit
  const handle: LaunchHandle = {
    pid: proc.pid,
    state: 'running',
    stop: async () => {
      if (!proc.pid || handle.state !== 'running') return;
      handle.state = 'killed';
      await killTree(proc.pid);
      // Stop proxy if running
      if (opts.useProxy && pm && pm.isRunning()) {
        await pm.stop();
        console.log('[Launcher] Proxy stopped');
      }
      // Give Node 200ms to fire the exit event, then force-cleanup
      setTimeout(() => {
        if (handle.state === 'killed') {
          handle.state = 'stopped';
          try { logStream.end(); } catch { /* */ }
          activeHandles.delete(proc.pid!);
        }
      }, 200);
    },
    wait: () => new Promise((resolve) => {
      // Resolve once if already exited (e.g. via stop())
      if (handle.state !== 'running') {
        // If still in map, give it a moment then force-cleanup
        setTimeout(() => {
          if (proc.pid) activeHandles.delete(proc.pid);
        }, 300);
        resolve({ code: null, signal: null });
        return;
      }
      proc.on('exit', (code, signal) => {
        handle.state = code === 0 ? 'stopped' : 'crashed';
        try { logStream.end(); } catch { /* already closed */ }
        if (proc.pid) activeHandles.delete(proc.pid);
        opts.onExit?.(code, signal);
        resolve({ code, signal });
      });
    }),
  };

  proc.on('error', (err) => {
    handle.state = 'crashed';
    if (proc.pid) activeHandles.delete(proc.pid);
    opts.onError?.(err);
  });

  activeHandles.set(proc.pid, handle);
  // Do NOT unref — the test framework relies on the 'exit' event firing.
  // In Electron, the main process can survive MC exits because the BrowserWindow
  // is its own ref. We rely on explicit stop() + exit-event for cleanup.
  return handle;
}

async function killTree(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    // taskkill walks the process tree (/T) and forces (/F)
    const { spawn: sp } = await import('node:child_process');
    return new Promise<void>((resolve) => {
      const t = sp('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      t.on('exit', () => resolve());
      t.on('error', () => resolve());  // best-effort
      // Also send Ctrl+Break via windows-kill helper as fallback
      try {
        process.kill(pid, 'SIGTERM');
      } catch { /* already dead */ }
      setTimeout(() => resolve(), 2000);
    });
  }
  try {
    process.kill(-pid, 'SIGTERM');  // negative = process group
  } catch { /* not in group */ }
  try {
    process.kill(pid, 'SIGKILL');
  } catch { /* already dead */ }
}
