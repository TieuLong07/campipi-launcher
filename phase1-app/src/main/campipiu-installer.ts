import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWriteStream } from 'node:fs';

const CAMPIPIU_ID = 'campipiu';
const MANIFEST_URL = 'https://raw.githubusercontent.com/TieuLong07/mcpubg-modpack/main/modpack-manifest.json';

export interface ModInfo {
  filename: string;
  sha256: string;
  size: number;
  url: string;
}

export interface InstallProgress {
  phase: 'downloading' | 'extracting' | 'done' | 'error';
  downloaded: number;
  total: number;
  filename: string;
  bytesDownloaded: number;
  bytesTotal: number;
}

export class CampipiuInstaller {
  private runtimeRoot: string;

  constructor(runtimeRoot: string) {
    this.runtimeRoot = runtimeRoot;
  }

  /**
   * Check if campipiu is installed
   */
  isInstalled(): boolean {
    const instanceDir = join(this.runtimeRoot, 'versions', CAMPIPIU_ID);
    const modsDir = join(instanceDir, 'mods');
    return existsSync(instanceDir) && existsSync(modsDir);
  }

  /**
   * Get instance directory path
   */
  getInstanceDir(): string {
    return join(this.runtimeRoot, 'versions', CAMPIPIU_ID);
  }

  /**
   * Get mods directory path
   */
  getModsDir(): string {
    return join(this.runtimeRoot, 'versions', CAMPIPIU_ID, 'mods');
  }

  /**
   * Install campipiu from scratch
   * 1. Create folder structure
   * 2. Copy version JSON + JAR from cam instance
   * 3. Download manifest
   * 4. Download all mods
   * 5. Save version file
   */
  async install(
    onProgress?: (progress: InstallProgress) => void
  ): Promise<{ success: boolean; modsInstalled: number; error?: string }> {
    try {
      const instanceDir = this.getInstanceDir();
      const modsDir = this.getModsDir();

      // Create folder structure
      if (!existsSync(instanceDir)) {
        mkdirSync(instanceDir, { recursive: true });
      }
      if (!existsSync(modsDir)) {
        mkdirSync(modsDir, { recursive: true });
      }

      // Copy version JSON + JAR from cam instance
      const camDir = join(this.runtimeRoot, 'versions', 'cam');
      const camJson = join(camDir, 'cam.json');
      const camJar = join(camDir, 'cam.jar');
      
      try {
        if (existsSync(camJson)) {
          // Read cam.json and replace "id": "cam" with "id": "campipiu"
          const camJsonContent = readFileSync(camJson, 'utf-8');
          const campipiuJsonContent = camJsonContent.replace(/"id"\s*:\s*"cam"/, '"id": "campipiu"');
          writeFileSync(join(instanceDir, 'campipiu.json'), campipiuJsonContent, 'utf-8');
          console.log('[CampipiuInstaller] Created campipiu.json');
        } else {
          console.warn('[CampipiuInstaller] cam.json not found:', camJson);
        }
        
        if (existsSync(camJar)) {
          // Copy JAR (binary copy)
          const { copyFileSync } = await import('node:fs');
          copyFileSync(camJar, join(instanceDir, 'campipiu.jar'));
          console.log('[CampipiuInstaller] Copied campipiu.jar');
        } else {
          console.warn('[CampipiuInstaller] cam.jar not found:', camJar);
        }
      } catch (copyErr) {
        console.error('[CampipiuInstaller] Error copying version files:', copyErr);
        // Continue anyway - mods are more important
      }

      // Fetch manifest
      onProgress?.({
        phase: 'downloading',
        downloaded: 0,
        total: 0,
        filename: 'manifest.json',
        bytesDownloaded: 0,
        bytesTotal: 0,
      });

      const manifest = await this.fetchManifest();
      const mods = manifest.mods;
      let downloadedCount = 0;
      let totalBytes = 0;
      let downloadedBytes = 0;

      // Calculate total size
      for (const mod of mods) {
        totalBytes += mod.size;
      }

      // Download each mod
      for (const mod of mods) {
        const modPath = join(modsDir, mod.filename);
        
        // Skip if already exists with correct hash
        if (existsSync(modPath)) {
          const existingHash = await this.hashFile(modPath);
          if (existingHash === mod.sha256) {
            downloadedCount++;
            downloadedBytes += mod.size;
            continue;
          }
        }

        onProgress?.({
          phase: 'downloading',
          downloaded: downloadedCount,
          total: mods.length,
          filename: mod.filename,
          bytesDownloaded: downloadedBytes,
          bytesTotal: totalBytes,
        });

        await this.downloadMod(mod, modPath);
        downloadedCount++;
        downloadedBytes += mod.size;
      }

      // Save version file
      const versionFile = join(instanceDir, '.mcpubg-version');
      writeFileSync(versionFile, manifest.version, 'utf-8');

      onProgress?.({
        phase: 'done',
        downloaded: mods.length,
        total: mods.length,
        filename: '',
        bytesDownloaded: totalBytes,
        bytesTotal: totalBytes,
      });

      return { success: true, modsInstalled: mods.length };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      onProgress?.({
        phase: 'error',
        downloaded: 0,
        total: 0,
        filename: '',
        bytesDownloaded: 0,
        bytesTotal: 0,
      });
      return { success: false, modsInstalled: 0, error: errMsg };
    }
  }

  /**
   * Fetch manifest from GitHub
   */
  private async fetchManifest(): Promise<{ version: string; mods: ModInfo[] }> {
    const cacheBuster = Date.now();
    const url = `${MANIFEST_URL}?t=${cacheBuster}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status}`);
    }
    const data = await response.json() as { version: string; mods: ModInfo[] };
    return data;
  }

  /**
   * Download a single mod
   */
  private async downloadMod(mod: ModInfo, destPath: string): Promise<void> {
    const response = await fetch(mod.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${mod.filename}: ${response.status}`);
    }

    const fileStream = createWriteStream(destPath);
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error(`No body for ${mod.filename}`);
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
    }

    fileStream.end();
    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });
  }

  /**
   * Hash a file (SHA256)
   */
  private async hashFile(filePath: string): Promise<string> {
    const { createHash } = await import('node:crypto');
    const { readFileSync } = await import('node:fs');
    const data = readFileSync(filePath);
    return createHash('sha256').update(data).digest('hex');
  }
}
