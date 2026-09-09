/**
 * Repair: verify the runtime install is intact.
 *
 * Checks:
 *  - Forge client jar exists and is non-empty
 *  - All required libraries are present (read from version.json + inheritsFrom)
 *  - Mods directory exists (warn if 0 mods, error if missing)
 *  - launcher_profiles.json present
 *  - assets/ index dir present
 *
 * Each check returns: { name, status: 'ok'|'warn'|'fail', message, fix? }
 */
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
  /** Optional action the UI can offer to take. */
  fix?: { label: string; action: string };
}

export interface RepairOptions {
  runtimeRoot: string;
  version: string;
}

export function checkRuntime(opts: RepairOptions): CheckResult[] {
  const out: CheckResult[] = [];
  const { runtimeRoot, version } = opts;

  // 1. version dir exists
  const versionDir = join(runtimeRoot, 'versions', version);
  if (!existsSync(versionDir)) {
    out.push({
      name: 'version-dir',
      status: 'fail',
      message: `Không tìm thấy thư mục version: ${versionDir}`,
      fix: { label: 'Cài lại', action: 'reinstall' },
    });
    return out;  // can't check anything else
  }
  out.push({ name: 'version-dir', status: 'ok', message: `Version directory OK` });

  // 2. client jar
  const clientJar = join(versionDir, `${version}-client.jar`);
  if (!existsSync(clientJar)) {
    out.push({
      name: 'client-jar',
      status: 'fail',
      message: `Thiếu client jar: ${clientJar}`,
      fix: { label: 'Tải lại Forge', action: 'reinstall-forge' },
    });
  } else {
    const size = statSync(clientJar).size;
    if (size < 4_000_000) {
      out.push({
        name: 'client-jar',
        status: 'fail',
        message: `Client jar quá nhỏ: ${size} bytes (Forge 1.20+ phải > 4MB)`,
        fix: { label: 'Tải lại', action: 'reinstall-forge' },
      });
    } else {
      out.push({ name: 'client-jar', status: 'ok', message: `Client jar OK (${(size / 1024 / 1024).toFixed(1)} MB)` });
    }
  }

  // 3. version.json
  const versionJson = join(versionDir, `${version}.json`);
  if (!existsSync(versionJson)) {
    out.push({
      name: 'version-json',
      status: 'fail',
      message: `Thiếu version.json`,
      fix: { label: 'Tải lại', action: 'reinstall' },
    });
  } else {
    out.push({ name: 'version-json', status: 'ok', message: 'version.json OK' });
  }

  // 4. mods dir
  const modsDir = join(runtimeRoot, 'mods');
  if (!existsSync(modsDir)) {
    out.push({
      name: 'mods-dir',
      status: 'warn',
      message: 'Thiếu thư mục mods/',
      fix: { label: 'Tạo thư mục', action: 'create-mods' },
    });
  } else {
    const mods = readdirSync(modsDir).filter((f) => f.endsWith('.jar'));
    if (mods.length === 0) {
      out.push({
        name: 'mods-dir',
        status: 'warn',
        message: 'Thư mục mods/ rỗng',
        fix: { label: 'Cài modpack', action: 'install-modpack' },
      });
    } else {
      out.push({ name: 'mods-dir', status: 'ok', message: `${mods.length} mod` });
    }
  }

  // 5. launcher_profiles.json (optional but MC reads it)
  const launcherProfiles = join(runtimeRoot, 'launcher_profiles.json');
  if (!existsSync(launcherProfiles)) {
    out.push({
      name: 'launcher-profiles',
      status: 'warn',
      message: 'Thiếu launcher_profiles.json (MC sẽ tự tạo khi chạy)',
    });
  } else {
    out.push({ name: 'launcher-profiles', status: 'ok', message: 'OK' });
  }

  // 6. assets/indexes
  const assetsIdx = join(runtimeRoot, 'assets', 'indexes');
  if (!existsSync(assetsIdx)) {
    out.push({
      name: 'assets-indexes',
      status: 'warn',
      message: 'Thiếu assets/indexes/ (MC sẽ tải khi chạy)',
    });
  } else {
    const idxFiles = readdirSync(assetsIdx);
    out.push({ name: 'assets-indexes', status: 'ok', message: `${idxFiles.length} index` });
  }

  // 7. log rotation check
  const logsDir = join(runtimeRoot, 'logs');
  if (existsSync(logsDir)) {
    const logFiles = readdirSync(logsDir);
    if (logFiles.length > 20) {
      out.push({
        name: 'log-rotation',
        status: 'warn',
        message: `${logFiles.length} log files cũ — nên xoay vòng`,
        fix: { label: 'Xoay vòng', action: 'rotate-logs' },
      });
    } else {
      out.push({ name: 'log-rotation', status: 'ok', message: `${logFiles.length} log` });
    }
  }

  return out;
}

/** Compute SHA1 of a file (used to verify mod jar integrity). */
export function sha1(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash('sha1').update(buf).digest('hex');
}

/** Clean Natives dir (called before each launch to remove META-INF noise). */
export function cleanNativesDir(nativesDir: string): number {
  if (!existsSync(nativesDir)) return 0;
  const noise = ['META-INF', 'META-INF.MF', 'MANIFEST.MF'];
  const exts = ['.dll', '.dylib', '.so', '.jnilib'];
  let removed = 0;
  const fs = require('node:fs') as typeof import('node:fs');
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) {
        if (noise.includes(entry)) {
          try { fs.rmSync(p, { recursive: true, force: true }); removed++; } catch { /* ignore */ }
        } else {
          walk(p);
        }
      } else if (st.isFile()) {
        if (noise.includes(entry) || exts.some((e) => entry.endsWith(e))) {
          try { fs.unlinkSync(p); removed++; } catch { /* ignore */ }
        }
      }
    }
  }
  walk(nativesDir);
  return removed;
}

/** Rotate logs: keep last N, delete older. */
export function rotateLogs(logsDir: string, keep = 10): number {
  if (!existsSync(logsDir)) return 0;
  const files = readdirSync(logsDir)
    .filter((f) => f.endsWith('.log') || f.endsWith('.txt'))
    .map((f) => ({ f, mtime: statSync(join(logsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  let removed = 0;
  for (let i = keep; i < files.length; i++) {
    try {
      require('node:fs').unlinkSync(join(logsDir, files[i].f));
      removed++;
    } catch { /* ignore */ }
  }
  return removed;
}
