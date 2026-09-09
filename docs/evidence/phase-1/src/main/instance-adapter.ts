/**
 * Adapter that reads the on-disk runtime install (built during Phase 0) and
 * converts it into the renderer-facing state. This is the single source of
 * truth for "what instances does the user have right now?".
 */
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
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
  for (const entry of readdirSync(versionsDir)) {
    const versionFolder = join(versionsDir, entry);
    if (!statSync(versionFolder).isDirectory()) continue;
    const jsonPath = join(versionFolder, `${entry}.json`);
    const hasClient = existsSync(join(versionFolder, `${entry}-client.jar`));
    if (!hasClient && !existsSync(jsonPath)) continue;
    const modsDir = join(runtimeRoot, 'mods');
    const modsCount = existsSync(modsDir) ? readdirSync(modsDir).filter(f => f.endsWith('.jar')).length : 0;
    out.push({
      id: entry,
      name: basename(entry, '.json').replace(/^\d+\.\d+\.\d+-/, ''),
      versionFolder: entry,
      hasClient,
      modsCount,
    });
  }
  return out;
}

function toRendererInstance(raw: RawInstance, isSelected: boolean): Launcher.Instance {
  const status: Launcher.InstanceStatus = raw.hasClient
    ? (raw.modsCount > 0 ? 'ready' : 'need-download')
    : 'empty';
  return {
    id: raw.id,
    name: humanizeName(raw.id),
    version: raw.versionFolder,
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
  // Pick the first instance with a client jar; fall back to the first one.
  // We prefer a complete install over an empty vanilla placeholder.
  const ready = raws.find((r) => r.hasClient) ?? raws[0];
  const selectedId = ready.id;
  return {
    instances: raws.map((r) => toRendererInstance(r, r.id === selectedId)),
    selectedInstanceId: selectedId,
    java: { path: javaPath, version: javaVersion, ok: !!javaPath },
    launcherVersion: '0.0.2-alpha',
    hasUpdate: true,
    ramMaxMb: 4096,
  };
}
