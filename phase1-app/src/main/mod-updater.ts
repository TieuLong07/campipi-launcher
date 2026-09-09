/**
 * Mod update checker: fetches manifest from GitHub, compares with local mods
 * for a specific instance, and provides update functionality.
 *
 * Layout (TLauncher-style):
 *   <runtimeRoot>/versions/<instance>/mods/  ← per-instance mods
 *   <runtimeRoot>/versions/<instance>/.mcpubg-version  ← instance modpack version file
 */
import { existsSync, readdirSync, createWriteStream, statSync, readFileSync, writeFileSync } from 'node:fs';
import * as fs from 'node:fs';
import { join } from 'node:path';
import https from 'node:https';

const MANIFEST_URL = 'https://raw.githubusercontent.com/TieuLong07/mcpubg-modpack/main/modpack-manifest.json';

export interface ModEntry {
  filename: string;
  size: number;
  sha256: string;
  url: string;
}

export interface ModManifest {
  version: string;
  minecraft_version: string;
  forge_version: string;
  updated_at: string;
  mod_count: number;
  total_size: number;
  manifest_url: string;
  mods: ModEntry[];
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  modsToAdd: { filename: string; size: number; url: string }[];
  modsToUpdate: { filename: string; size: number; url: string; localSha256: string }[];
  modsToRemove: string[];
  totalSize: number;
}

export class ModUpdateChecker {
  private runtimeRoot: string;
  private instanceName: string;

  constructor(runtimeRoot: string, instanceName: string = 'cam') {
    this.runtimeRoot = runtimeRoot;
    this.instanceName = instanceName;
  }

  /** Get the mods directory for the current instance */
  private getModsDir(): string {
    return join(this.runtimeRoot, 'versions', this.instanceName, 'mods');
  }

  /** Get the version file path for the current instance */
  private getVersionFile(): string {
    return join(this.runtimeRoot, 'versions', this.instanceName, '.mcpubg-version');
  }

  /** Read the local modpack version for the current instance */
  private getLocalVersion(): string {
    const vf = this.getVersionFile();
    if (!existsSync(vf)) return '0.0.0';
    try {
      return readFileSync(vf, 'utf-8').trim();
    } catch {
      return '0.0.0';
    }
  }

  /** Set the local modpack version for the current instance */
  private setLocalVersion(version: string): void {
    const vf = this.getVersionFile();
    writeFileSync(vf, version);
  }

  /**
   * Fetch manifest from GitHub
   */
  async fetchManifest(): Promise<ModManifest> {
    return new Promise((resolve, reject) => {
      // Add cache-buster to avoid stale GitHub CDN cache
      const url = MANIFEST_URL + `?t=${Date.now()}`;
      const req = https.get(url, { headers: { 'User-Agent': 'MCPubg-Launcher/0.2.0' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          // Follow redirect
          https.get(res.headers.location!, { headers: { 'User-Agent': 'MCPubg-Launcher/0.2.0' } }, (res2) => {
            let data = '';
            res2.on('data', (chunk) => data += chunk);
            res2.on('end', () => {
              try {
                const manifest = JSON.parse(data) as ModManifest;
                
                resolve(manifest);
              } catch (err) {
                reject(new Error('Failed to parse manifest'));
              }
            });
          }).on('error', reject);
          return;
        }
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const manifest = JSON.parse(data) as ModManifest;
            
            resolve(manifest);
          } catch (err) {
            reject(new Error('Failed to parse manifest'));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => req.destroy(new Error('Manifest fetch timeout')));
    });
  }

  /**
   * Get local mods list with SHA256 (for current instance)
   */
  getLocalMods(): Map<string, { size: number; sha256: string }> {
    const modsDir = this.getModsDir();
    const result = new Map<string, { size: number; sha256: string }>();
    if (!existsSync(modsDir)) return result;
    const crypto = require('node:crypto') as typeof import('node:crypto');
    for (const f of readdirSync(modsDir)) {
      if (!f.endsWith('.jar')) continue;
      const filePath = join(modsDir, f);
      const data = require('node:fs').readFileSync(filePath);
      const sha256 = crypto.createHash('sha256').update(data).digest('hex');
      const size = statSync(filePath).size;
      result.set(f, { size, sha256 });
    }
    return result;
  }

  /**
   * Check for updates by comparing local mods with manifest
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    const manifest = await this.fetchManifest();
    const localMods = this.getLocalMods();

    const modsToAdd: { filename: string; size: number; url: string }[] = [];
    const modsToUpdate: { filename: string; size: number; url: string; localSha256: string }[] = [];

    for (const mod of manifest.mods) {
      const local = localMods.get(mod.filename);
      if (!local) {
        // New mod - download
        modsToAdd.push({ filename: mod.filename, size: mod.size, url: mod.url });
      } else if (local.sha256 !== mod.sha256) {
        // Existing mod - changed, re-download
        modsToUpdate.push({
          filename: mod.filename,
          size: mod.size,
          url: mod.url,
          localSha256: local.sha256,
        });
      }
    }

    // Find mods to remove (in local but not in manifest)
    const manifestFilenames = new Set(manifest.mods.map((m) => m.filename));
    const modsToRemove: string[] = [];
    for (const localName of localMods.keys()) {
      if (!manifestFilenames.has(localName)) {
        modsToRemove.push(localName);
      }
    }

    const totalSize = [...modsToAdd, ...modsToUpdate].reduce((sum, m) => sum + m.size, 0);

    return {
      hasUpdate: modsToAdd.length > 0 || modsToUpdate.length > 0 || modsToRemove.length > 0,
      currentVersion: this.getLocalVersion(),
      latestVersion: manifest.version,
      modsToAdd,
      modsToUpdate,
      modsToRemove,
      totalSize,
    };
  }

  /**
   * Download and apply update (for current instance)
   */
  async applyUpdate(
    onProgress?: (progress: { downloaded: number; total: number; filename: string; bytesDownloaded: number; bytesTotal: number }) => void
  ): Promise<{ added: number; updated: number; removed: number; version: string }> {
    const result = await this.checkForUpdates();
    const modsDir = this.getModsDir();
    if (!existsSync(modsDir)) require('node:fs').mkdirSync(modsDir, { recursive: true });

    const toDownload = [...result.modsToAdd, ...result.modsToUpdate];
    let downloaded = 0;

    for (const mod of toDownload) {
      const localPath = join(modsDir, mod.filename);
      await this.downloadFile(mod.url, localPath, mod.size, (bytesDownloaded) => {
        onProgress?.({
          downloaded,
          total: toDownload.length,
          filename: mod.filename,
          bytesDownloaded,
          bytesTotal: mod.size,
        });
      });
      downloaded++;
    }

    // Remove mods that are no longer in manifest
    for (const filename of result.modsToRemove) {
      const localPath = join(modsDir, filename);
      try {
        fs.unlinkSync(localPath);
      } catch { /* ignore */ }
    }

    // Update local version file
    this.setLocalVersion(result.latestVersion);

    return {
      added: result.modsToAdd.length,
      updated: result.modsToUpdate.length,
      removed: result.modsToRemove.length,
      version: result.latestVersion,
    };
  }

  /**
   * Download file with progress callback
   */
  private downloadFile(
    url: string,
    destPath: string,
    expectedSize: number,
    onProgress?: (bytesDownloaded: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const makeRequest = (reqUrl: string) => {
        const req = https.get(
          reqUrl,
          { headers: { 'User-Agent': 'MCPubg-Launcher/0.2.0' } },
          (response) => {
            // Follow redirects
            if (response.statusCode === 302 || response.statusCode === 301) {
              const redirectUrl = response.headers.location!;
              response.resume(); // drain
              makeRequest(redirectUrl);
              return;
            }
            if (response.statusCode !== 200) {
              reject(new Error(`HTTP ${response.statusCode} for ${reqUrl}`));
              return;
            }
            const file = createWriteStream(destPath);
            let downloaded = 0;
            response.on('data', (chunk) => {
              downloaded += chunk.length;
              onProgress?.(downloaded);
            });
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              // Verify size
              const actualSize = statSync(destPath).size;
              if (expectedSize > 0 && actualSize !== expectedSize) {
                fs.unlinkSync(destPath);
                reject(new Error(`Size mismatch: expected ${expectedSize}, got ${actualSize}`));
              } else {
                resolve();
              }
            });
            file.on('error', (err) => {
              fs.unlink(destPath, () => {});
              reject(err);
            });
          }
        );
        req.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
        req.setTimeout(60000, () => req.destroy(new Error('Download timeout')));
      };
      makeRequest(url);
    });
  }
}
