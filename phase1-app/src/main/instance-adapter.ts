/**
 * Adapter that reads the on-disk runtime install (built during Phase 0) and
 * converts it into the renderer-facing state. This is the single source of
 * truth for "what instances does the user have right now?".
 */
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { Launcher } from '@shared/types';

interface RawInstance {
  id: string;
  name: string;
  versionFolder: string;     // e.g. "1.20.1-forge-47.4.10"
  hasClient: boolean;
  modsCount: number;
}

function detectInstances(runtimeRoot: string): RawInstance[] {
  const versionsDir = join(runtimeRoot, 'versions');
  if (!existsSync(versionsDir)) return [];
  const out: RawInstance[] = [];

  // Scan all instance folders in versions/
  for (const entry of readdirSync(versionsDir)) {
    const versionFolder = join(versionsDir, entry);
    if (!statSync(versionFolder).isDirectory()) continue;

    // Skip pure-version folders (e.g. "1.20.1-forge-47.4.10") — only count instance folders
    // Instance folder: has mods/ or saves/ subfolder
    const modsDir = join(versionFolder, 'mods');
    const savesDir = join(versionFolder, 'saves');
    const isInstance = existsSync(modsDir) || existsSync(savesDir);
    if (!isInstance) continue;

    // Count mods in this instance's mods/ folder
    const modsCount = existsSync(modsDir)
      ? readdirSync(modsDir).filter(f => f.endsWith('.jar')).length
      : 0;

    // Find the MC version this instance uses (look for x.x.x-forge-*.json inside)
    const mcVersion = findMcVersion(versionFolder);

    const hasClient = !!mcVersion; // instance needs a matching version

    out.push({
      id: entry,
      name: humanizeName(entry),
      versionFolder: mcVersion || entry,
      hasClient,
      modsCount,
    });
  }
  return out;
}

/**
 * Find the MC version folder this instance points to.
 * TLauncher-style: instance JSON is standalone (no inheritsFrom).
 * Detect via mainClass or forge marker — find matching version folder
 * that has the .jar and a 1.x.x-forge-*.json sibling.
 */
function findMcVersion(instanceDir: string): string | null {
  // Strategy: list all folders in versions/ that look like "1.20.1-forge-XXX" or "1.20.1"
  // and have both <name>.json and <name>.jar files
  const versionsDir = dirname(instanceDir);
  if (!existsSync(versionsDir)) return null;
  for (const entry of readdirSync(versionsDir)) {
    const folder = join(versionsDir, entry);
    if (!statSync(folder).isDirectory()) continue;
    const hasJar = existsSync(join(folder, `${entry}.jar`));
    const hasJson = existsSync(join(folder, `${entry}.json`));
    if (hasJar && hasJson) {
      // Prefer forge version (1.20.1-forge-*) over vanilla (1.20.1)
      if (entry.includes('forge')) return entry;
    }
  }
  return null;
}

function toRendererInstance(raw: RawInstance, isSelected: boolean): Launcher.Instance {
  const status: Launcher.InstanceStatus = raw.hasClient
    ? (raw.modsCount > 0 ? 'ready' : 'need-download')
    : 'empty';
  return {
    id: raw.id,
    name: humanizeName(raw.id),
    version: raw.versionFolder,
    modsCount: raw.modsCount,
    badge: isSelected
      ? { label: 'ĐANG CHỌN', kind: 'active' }
      : isLite(raw.id) ? { label: 'TIẾT KIỆM RAM', kind: 'neutral' } : undefined,
    status,
    statusText: statusTextFor(status, raw.modsCount),
    details: detailsFor(raw),
    actions: actionsFor(raw, isSelected),
  };
}

function humanizeName(id: string): string {
  if (id === 'cam' || id === 'cam-lite' || id === 'vanilla') return id;
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function isLite(id: string): boolean { return id.includes('lite'); }

// Persist selected instance across restarts
const SELECTION_FILE = join(dirname(process.execPath), '.mcpubg-selection');
function loadSelectedId(): string | null {
  try {
    if (existsSync(SELECTION_FILE)) return readFileSync(SELECTION_FILE, 'utf-8').trim();
  } catch { /* ignore */ }
  return null;
}
function saveSelectedId(id: string): void {
  try { writeFileSync(SELECTION_FILE, id); } catch { /* ignore */ }
}
function statusTextFor(s: Launcher.InstanceStatus, mods: number): string {
  switch (s) {
    case 'ready': return 'Sẵn sàng vào game';
    case 'need-download': return `Cần tải tài nguyên (${mods} mods)`;
    case 'broken': return 'Phát hiện lỗi — chạy "Sửa lỗi"';
    case 'empty': return 'Chưa cài đặt';
    case 'update-available': return 'Có bản cập nhật mới';
  }
}
function detailsFor(raw: RawInstance): string[] {
  if (raw.id === 'cam' || raw.id === 'cam-lite') {
    const liteExtra = raw.id === 'cam-lite' ? 'Phù hợp card đồ họa tích hợp' : 'Đã tích hợp gói Resource Pack PUBG';
    return [
      `• ${raw.modsCount} Mods hoạt động (TACZ, GeckoLib, Citadel)`,
      liteExtra,
    ];
  }
  if (raw.id === 'vanilla') {
    return ['• Minecraft gốc, không Forge', '• Dùng để test chẩn đoán'];
  }
  return [`• ${raw.modsCount} mods`, '• Cấu hình chưa rõ'];
}
function actionsFor(raw: RawInstance, isSelected: boolean): Launcher.Instance['actions'] {
  if (raw.id === 'cam') {
    return [
      { id: 'update', label: 'Cập nhật v0.0.3' },
      { id: 'verify', label: 'Sửa lỗi' },
    ];
  }
  if (raw.id === 'cam-lite') {
    return [
      { id: 'select', label: 'Kích hoạt' },
      { id: 'download', label: 'Tải tài nguyên' },
    ];
  }
  if (raw.id === 'vanilla') {
    return [
      { id: 'select', label: 'Kích hoạt' },
      { id: 'open-folder', label: 'Mở Folder' },
    ];
  }
  return isSelected ? [{ id: 'verify', label: 'Sửa lỗi' }] : [{ id: 'select', label: 'Kích hoạt' }];
}

export function readState(runtimeRoot: string, javaPath: string, javaVersion: string): Launcher.AppState {
  const raws = detectInstances(runtimeRoot);
  if (raws.length === 0) {
    throw new Error(`No instances found under ${runtimeRoot}. Run clean-install.mjs first.`);
  }
  // Restore persisted selection, or pick first instance with a client jar
  const savedId = loadSelectedId();
  const saved = savedId && raws.some(r => r.id === savedId) ? raws.find(r => r.id === savedId) : null;
  const ready = saved ?? raws.find((r) => r.hasClient) ?? raws[0];
  const selectedId = ready.id;
  saveSelectedId(selectedId);  // persist for next boot
  return {
    instances: raws.map((r) => toRendererInstance(r, r.id === selectedId)),
    selectedInstanceId: selectedId,
    java: { path: javaPath, version: javaVersion, ok: !!javaPath },
    launcherVersion: require('../../package.json').version ?? '0.0.2',
    hasUpdate: false,  // UpdateBanner checks independently via IPC
    ramMaxMb: 4096,
  };
}
