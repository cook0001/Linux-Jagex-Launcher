import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';
import * as electron from 'electron';
const app = (electron as any)?.app || ((electron as any)?.default?.app) || undefined;
import { store } from './store.ts';

const GITHUB_REPO = 'cook0001/Linux-Jagex-Launcher';
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export type PackageFormat = 'appimage' | 'flatpak' | 'deb' | 'aur' | 'tar' | 'dev';

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
}

export interface ReleaseInfo {
  version: string;
  tagName: string;
  releaseNotes: string;
  publishedAt: string;
  htmlUrl: string;
  assets: {
    appImage?: ReleaseAsset;
    deb?: ReleaseAsset;
    tar?: ReleaseAsset;
    checksums?: ReleaseAsset;
  };
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  packageFormat: PackageFormat;
  releaseInfo?: ReleaseInfo;
  error?: string;
}

export interface UpdateProgress {
  status: 'checking' | 'downloading' | 'verifying' | 'ready' | 'error';
  progress: number; // 0 to 100
  receivedBytes?: number;
  totalBytes?: number;
  message: string;
}

/**
 * Robust semantic version comparison.
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').trim();
  const clean2 = v2.replace(/^v/, '').trim();

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export class AutoUpdater {
  private updateDir: string;
  private downloadedUpdatePath: string | null = null;
  private downloadedVersion: string | null = null;
  private isDownloading: boolean = false;

  constructor() {
    this.updateDir = path.join(os.homedir(), '.local', 'share', 'linux-jagex-launcher', 'updates');
    if (!fs.existsSync(this.updateDir)) {
      try {
        fs.mkdirSync(this.updateDir, { recursive: true });
      } catch {
        // Ignore if read-only or in testing
      }
    }
  }

  public getPackageFormat(): PackageFormat {
    if (typeof app === 'undefined' || !app || !app.isPackaged) return 'dev';
    if (process.env.APPIMAGE) return 'appimage';
    if (fs.existsSync('/.flatpak-info') || process.env.FLATPAK_ID) return 'flatpak';
    if (process.env.AUR_PKG) return 'aur';
    if (fs.existsSync('/usr/share/doc/jagex-launcher') || fs.existsSync('/var/lib/dpkg/info/jagex-launcher.list')) {
      return 'deb';
    }
    return 'tar';
  }

  public getCurrentVersion(): string {
    if (typeof app !== 'undefined' && app && typeof app.getVersion === 'function') {
      return app.getVersion() || '1.2.0';
    }
    return '1.2.0';
  }

  public getFormatDisplayLabel(format?: PackageFormat): string {
    const f = format || this.getPackageFormat();
    switch (f) {
      case 'appimage': return 'AppImage (Direct In-App Updates)';
      case 'flatpak': return 'Flatpak / Flathub';
      case 'deb': return 'Debian / Ubuntu (.deb)';
      case 'aur': return 'Arch Linux (AUR)';
      case 'tar': return 'Standalone Tarball';
      case 'dev': return 'Development Environment';
    }
  }

  public async checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = this.getCurrentVersion();
    const packageFormat = this.getPackageFormat();

    try {
      const res = await fetch(RELEASES_API_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': `Linux-Jagex-Launcher/${currentVersion}`
        },
        cache: 'no-store'
      });

      if (!res.ok) {
        if (res.status === 404) {
          return {
            updateAvailable: false,
            currentVersion,
            latestVersion: currentVersion,
            packageFormat,
            error: 'No releases found on GitHub.'
          };
        }
        throw new Error(`GitHub API request failed: ${res.status} ${res.statusText}`);
      }

      const release: any = await res.json();
      const tagName: string = release.tag_name || '';
      const remoteVersion = tagName.replace(/^v/, '');

      const assets: ReleaseInfo['assets'] = {};
      if (Array.isArray(release.assets)) {
        for (const a of release.assets) {
          const name: string = a.name || '';
          if (name.endsWith('.AppImage')) {
            assets.appImage = { name, url: a.browser_download_url, size: a.size };
          } else if (name.endsWith('.deb')) {
            assets.deb = { name, url: a.browser_download_url, size: a.size };
          } else if (name.endsWith('.tar.gz')) {
            assets.tar = { name, url: a.browser_download_url, size: a.size };
          } else if (name.includes('SHA256SUMS')) {
            assets.checksums = { name, url: a.browser_download_url, size: a.size };
          }
        }
      }

      const releaseInfo: ReleaseInfo = {
        version: remoteVersion,
        tagName,
        releaseNotes: release.body || 'New update available.',
        publishedAt: release.published_at || new Date().toISOString(),
        htmlUrl: release.html_url || `https://github.com/${GITHUB_REPO}/releases`,
        assets
      };

      const hasUpdate = compareSemver(remoteVersion, currentVersion) > 0;

      // Update store timestamp
      store.saveSettings({ lastUpdateCheck: Date.now() });

      return {
        updateAvailable: hasUpdate,
        currentVersion,
        latestVersion: remoteVersion,
        packageFormat,
        releaseInfo
      };
    } catch (e: any) {
      console.error('[Updater] Failed to check for updates:', e);
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        packageFormat,
        error: e.message
      };
    }
  }

  public async downloadUpdate(
    releaseInfo: ReleaseInfo,
    onProgress?: (p: UpdateProgress) => void
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (this.isDownloading) {
      throw new Error('A download is already in progress.');
    }

    const notify = (status: UpdateProgress['status'], progress: number, message: string, receivedBytes?: number, totalBytes?: number) => {
      if (onProgress) onProgress({ status, progress, message, receivedBytes, totalBytes });
    };

    const format = this.getPackageFormat();
    this.isDownloading = true;

    try {
      if (format === 'appimage') {
        const asset = releaseInfo.assets.appImage;
        if (!asset) throw new Error('AppImage asset not found in latest GitHub release.');

        const targetFile = path.join(this.updateDir, `Jagex-Launcher-${releaseInfo.version}.AppImage`);
        const tempFile = targetFile + '.part';

        notify('downloading', 0, `Downloading ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)} MB)...`, 0, asset.size);

        const res = await fetch(asset.url);
        if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

        const totalBytes = asset.size || parseInt(res.headers.get('content-length') || '0', 10);
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No readable stream from response');

        const fileStream = fs.createWriteStream(tempFile);
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            fileStream.write(Buffer.from(value));
            receivedBytes += value.length;
            const pct = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 50;
            notify('downloading', pct, `Downloading update: ${pct}%`, receivedBytes, totalBytes);
          }
        }

        await new Promise<void>((resolve, reject) => {
          fileStream.end((err?: Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        });

        notify('verifying', 95, 'Verifying file integrity...');

        // Verify Checksums if SHA256SUMS.txt asset is available
        if (releaseInfo.assets.checksums) {
          try {
            const sumRes = await fetch(releaseInfo.assets.checksums.url);
            if (sumRes.ok) {
              const sumText = await sumRes.text();
              const expectedMatch = sumText.split('\n').find(line => line.includes(asset.name));
              if (expectedMatch) {
                const expectedHash = expectedMatch.trim().split(/\s+/)[0];
                const fileBuf = fs.readFileSync(tempFile);
                const actualHash = crypto.createHash('sha256').update(fileBuf).digest('hex');
                if (expectedHash && actualHash !== expectedHash) {
                  throw new Error(`Checksum mismatch! Expected: ${expectedHash}, Got: ${actualHash}`);
                }
              }
            }
          } catch (sumErr) {
            console.warn('[Updater] Checksum verification warning:', sumErr);
          }
        }

        // Rename temp file to target and make executable
        if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
        fs.renameSync(tempFile, targetFile);
        fs.chmodSync(targetFile, 0o755);

        this.downloadedUpdatePath = targetFile;
        this.downloadedVersion = releaseInfo.version;

        notify('ready', 100, `Update v${releaseInfo.version} ready to install!`);
        return { success: true, filePath: targetFile };
      } else if (format === 'deb') {
        const asset = releaseInfo.assets.deb;
        if (!asset) throw new Error('Debian package asset not found in latest GitHub release.');

        const downloadsDir = app.getPath('downloads') || path.join(os.homedir(), 'Downloads');
        const targetFile = path.join(downloadsDir, asset.name);

        notify('downloading', 10, `Downloading ${asset.name} to Downloads folder...`, 0, asset.size);

        const res = await fetch(asset.url);
        if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

        const arrayBuf = await res.arrayBuffer();
        fs.writeFileSync(targetFile, Buffer.from(arrayBuf));

        notify('ready', 100, `Saved to ${targetFile}. Install via: sudo apt install ${targetFile}`);
        return { success: true, filePath: targetFile };
      } else {
        throw new Error(`In-app binary download is not applicable for ${format} packages. Please use your package manager.`);
      }
    } catch (e: any) {
      notify('error', 0, `Download failed: ${e.message}`);
      return { success: false, error: e.message };
    } finally {
      this.isDownloading = false;
    }
  }

  public applyUpdateAndRestart(): boolean {
    if (!this.downloadedUpdatePath || !fs.existsSync(this.downloadedUpdatePath)) {
      throw new Error('No downloaded update ready to install.');
    }

    const currentAppImage = process.env.APPIMAGE;
    console.log(`[Updater] Preparing to apply update: ${this.downloadedUpdatePath}`);

    if (currentAppImage && fs.existsSync(currentAppImage)) {
      try {
        // Try replacing the current AppImage file in-place
        const backupPath = currentAppImage + '.old';
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
        fs.copyFileSync(this.downloadedUpdatePath, currentAppImage);
        fs.chmodSync(currentAppImage, 0o755);

        if (app && typeof app.relaunch === 'function' && typeof app.exit === 'function') {
          app.relaunch({ execPath: currentAppImage });
          app.exit(0);
          return true;
        }

        // Fallback: spawn and quit
        const child = spawn(currentAppImage, process.argv.slice(1), {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        if (app) app.quit();
        return true;
      } catch (e: any) {
        console.warn(`[Updater] Could not replace ${currentAppImage} in-place (${e.message}). Spawning new binary directly.`);
      }
    }

    // Fallback: relaunch using the newly downloaded AppImage directly
    if (app && typeof app.relaunch === 'function' && typeof app.exit === 'function') {
      app.relaunch({ execPath: this.downloadedUpdatePath });
      app.exit(0);
      return true;
    }

    const child = spawn(this.downloadedUpdatePath, process.argv.slice(1), {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    if (app) app.quit();
    return true;
  }
}

export const updater = new AutoUpdater();
