import path from 'node:path';
import { createHash } from 'node:crypto';

/** Qualification only: explicit demo, no account impersonation or server join. */
export function createLaunchOptions({ root, java, version }) {
  if (!path.isAbsolute(root)) throw new Error('Install root must be absolute');
  if (!java || !path.isAbsolute(java)) throw new Error('Java executable must be absolute');
  if (!version) throw new Error('Version is required');
  return {
    gamePath: root, resourcePath: root, javaPath: java, version,
    launcherName: 'MCPubgQualification', launcherBrand: 'MCPubg',
    gameProfile: { name: 'DemoPlayer', id: '00000000000000000000000000000000' },
    accessToken: '0', demo: true, minMemory: 1024, maxMemory: 4096,
    extraJVMArgs: [], resolution: { width: 1100, height: 700 },
  };
}

export function verifySha1(bytes, expected) {
  if (!/^[a-f0-9]{40}$/i.test(expected) || createHash('sha1').update(bytes).digest('hex') !== expected.toLowerCase()) {
    throw new Error('Installer checksum mismatch');
  }
  return true;
}
