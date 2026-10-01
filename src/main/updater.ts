import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';
import * as electron from 'electron';
const app = (electron as any)?.app || ((electron as any)?.default?.app) || undefined;
import { store } from './store.ts';
import { desktopIntegration } from './desktop.ts';

const GITHUB_REPO = 'cook0001/Linux-Jagex-Launcher';
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export type PackageFormat = 'appimage' | 'flatpak' | 'snap' | 'deb' | 'aur' | 'tar' | 'dev';

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
    snap?: ReleaseAsset;
    checksums?: ReleaseAsset;
  };
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  packageFormat: PackageFormat;
  systemFamily: 'debian' | 'arch' | 'fedora' | 'unknown';
  supportedFormats: ('appimage' | 'deb' | 'tar' | 'snap')[];
  releaseInfo?: ReleaseInfo;
  error?: string;
}

export interface UpdateProgress {
  status: 'checking' | 'downloading' | 'verifying' | 'installing' | 'ready' | 'error';
  progress: number; // 0 to 100
  receivedBytes?: number;
  totalBytes?: number;
  message: string;
  speed?: string;
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
  private downloadedFormat: PackageFormat | null = null;
  private isDownloading: boolean = false;
  private isInstalling: boolean = false;

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
    if (process.env.APPIMAGE) return 'appimage';
    if (fs.existsSync('/.flatpak-info') || process.env.FLATPAK_ID) return 'flatpak';
    if (process.env.SNAP) return 'snap';
    if (process.env.AUR_PKG) return 'aur';
    if (fs.existsSync('/usr/share/doc/jagex-launcher') || fs.existsSync('/var/lib/dpkg/info/jagex-launcher.list')) {
      return 'deb';
    }
    if (typeof app === 'undefined' || !app || !app.isPackaged) return 'dev';
    return 'tar';
  }

  public getSystemFamily(): 'debian' | 'arch' | 'fedora' | 'unknown' {
    if (fs.existsSync('/etc/debian_version')) return 'debian';
    if (fs.existsSync('/etc/arch-release')) return 'arch';
    if (fs.existsSync('/etc/fedora-release')) return 'fedora';
    return 'unknown';
  }

  public getCurrentVersion(): string {
    if (typeof app !== 'undefined' && app && typeof app.getVersion === 'function') {
      return app.getVersion() || '1.4.3';
    }
    return '1.4.3';
  }

  public getFormatDisplayLabel(format?: PackageFormat): string {
    const f = format || this.getPackageFormat();
    switch (f) {
      case 'appimage': return 'AppImage (Direct In-App Updates)';
      case 'flatpak': return 'Flatpak / Flathub';
      case 'snap': return 'Snap (Managed by Snapd)';
      case 'deb': return 'Debian / Ubuntu (.deb)';
      case 'aur': return 'Arch Linux (AUR)';
      case 'tar': return 'Standalone Tarball';
      case 'dev': return 'Development Environment';
    }
  }

  public async checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = this.getCurrentVersion();
    const packageFormat = this.getPackageFormat();
    const systemFamily = this.getSystemFamily();

    try {
      const res = await fetch(RELEASES_API_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': `Linux-Jagex-Launcher/${currentVersion}`
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        if (res.status === 404) {
          return {
            updateAvailable: false,
            currentVersion,
            latestVersion: currentVersion,
            packageFormat,
            systemFamily,
            supportedFormats: [],
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
          } else if (name.endsWith('.snap')) {
            assets.snap = { name, url: a.browser_download_url, size: a.size };
          } else if (name.includes('SHA256SUMS')) {
            assets.checksums = { name, url: a.browser_download_url, size: a.size };
          }
        }
      }

      const supportedFormats: ('appimage' | 'deb' | 'tar' | 'snap')[] = [];
      if (assets.appImage) supportedFormats.push('appimage');
      if (assets.deb && (systemFamily === 'debian' || packageFormat === 'deb' || packageFormat === 'dev')) {
        supportedFormats.push('deb');
      }
      if (assets.snap) supportedFormats.push('snap');
      if (assets.tar) supportedFormats.push('tar');

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
        systemFamily,
        supportedFormats,
        releaseInfo
      };
    } catch (e: any) {
      console.error('[Updater] Failed to check for updates:', e);
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        packageFormat,
        systemFamily,
        supportedFormats: [],
        error: e.message
      };
    }
  }

  public async downloadUpdate(
    releaseInfo: ReleaseInfo,
    targetFormatOrProgress?: PackageFormat | ((p: UpdateProgress) => void),
    onProgress?: (p: UpdateProgress) => void
  ): Promise<{ success: boolean; filePath?: string; format?: PackageFormat; error?: string }> {
    if (this.isDownloading) {
      throw new Error('A download is already in progress.');
    }

    let chosenFormat: PackageFormat | undefined;
    let notifyCallback: ((p: UpdateProgress) => void) | undefined;

    if (typeof targetFormatOrProgress === 'function') {
      notifyCallback = targetFormatOrProgress;
      chosenFormat = undefined;
    } else {
      chosenFormat = targetFormatOrProgress;
      notifyCallback = onProgress;
    }

    const notify = (status: UpdateProgress['status'], progress: number, message: string, receivedBytes?: number, totalBytes?: number) => {
      if (notifyCallback) notifyCallback({ status, progress, message, receivedBytes, totalBytes });
    };

    const currentFormat = this.getPackageFormat();
    const systemFamily = this.getSystemFamily();

    // Determine target format if not explicitly passed
    let format = chosenFormat;
    if (!format) {
      if (currentFormat === 'appimage') {
        format = 'appimage';
      } else if (currentFormat === 'deb') {
        format = 'deb';
      } else if (systemFamily === 'debian' && releaseInfo.assets.deb) {
        format = 'deb';
      } else if (releaseInfo.assets.appImage) {
        format = 'appimage';
      } else if (releaseInfo.assets.tar) {
        format = 'tar';
      } else {
        format = currentFormat;
      }
    }

    this.isDownloading = true;

    try {
      let asset: ReleaseAsset | undefined;
      let targetFileName: string;

      if (format === 'appimage') {
        asset = releaseInfo.assets.appImage;
        if (!asset) throw new Error('AppImage asset not found in latest GitHub release.');
        targetFileName = `Jagex-Launcher-${releaseInfo.version}.AppImage`;
      } else if (format === 'deb') {
        asset = releaseInfo.assets.deb;
        if (!asset) throw new Error('Debian package asset (.deb) not found in latest GitHub release.');
        targetFileName = asset.name || `jagex-launcher_${releaseInfo.version}_amd64.deb`;
      } else if (format === 'snap') {
        asset = releaseInfo.assets.snap;
        if (!asset) throw new Error('Snap package asset (.snap) not found in latest GitHub release.');
        targetFileName = asset.name || `linux-jagex-launcher_${releaseInfo.version}_amd64.snap`;
      } else if (format === 'tar') {
        asset = releaseInfo.assets.tar;
        if (!asset) throw new Error('Tarball asset (.tar.gz) not found in latest GitHub release.');
        targetFileName = asset.name || `linux-jagex-launcher-${releaseInfo.version}.tar.gz`;
      } else {
        if (releaseInfo.assets.appImage) {
          format = 'appimage';
          asset = releaseInfo.assets.appImage;
          targetFileName = `Jagex-Launcher-${releaseInfo.version}.AppImage`;
        } else if (releaseInfo.assets.deb) {
          format = 'deb';
          asset = releaseInfo.assets.deb;
          targetFileName = releaseInfo.assets.deb.name;
        } else if (releaseInfo.assets.snap) {
          format = 'snap';
          asset = releaseInfo.assets.snap;
          targetFileName = releaseInfo.assets.snap.name;
        } else {
          throw new Error(`In-app binary download is not applicable for ${format} packages without release assets.`);
        }
      }

      const safeFileName = path.basename(targetFileName);
      const targetFile = path.join(this.updateDir, safeFileName);
      const tempFile = targetFile + '.part';

      notify('downloading', 0, `Downloading ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)} MB)...`, 0, asset.size);

      const res = await fetch(asset.url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

      const totalBytes = asset.size || parseInt(res.headers.get('content-length') || '0', 10);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No readable stream from response');

      const fileStream = fs.createWriteStream(tempFile);
      let receivedBytes = 0;
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          fileStream.write(Buffer.from(value));
          receivedBytes += value.length;
          const pct = totalBytes > 0 ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100)) : 50;
          const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
          const speedMb = (receivedBytes / 1024 / 1024 / elapsedSec).toFixed(1);
          const receivedMb = (receivedBytes / 1024 / 1024).toFixed(1);
          const totalMb = totalBytes > 0 ? (totalBytes / 1024 / 1024).toFixed(1) : '?';
          notify('downloading', pct, `Downloading update: ${pct}% (${receivedMb}/${totalMb} MB, ${speedMb} MB/s)`, receivedBytes, totalBytes);
        }
      }

      await new Promise<void>((resolve, reject) => {
        fileStream.end((err?: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      notify('verifying', 98, 'Verifying SHA-256 checksum integrity...');

      // Verify Checksums if SHA256SUMS.txt asset is available
      if (releaseInfo.assets.checksums) {
        try {
          const sumRes = await fetch(releaseInfo.assets.checksums.url, { signal: AbortSignal.timeout(15000) });
          if (sumRes.ok) {
            const sumText = await sumRes.text();
            const expectedMatch = sumText.split('\n').find(line => line.includes(asset!.name));
            if (expectedMatch) {
              const expectedHash = expectedMatch.trim().split(/\s+/)[0];
              const fileBuf = fs.readFileSync(tempFile);
              const actualHash = crypto.createHash('sha256').update(fileBuf).digest('hex');
              if (expectedHash && actualHash !== expectedHash) {
                try { fs.unlinkSync(tempFile); } catch {}
                throw new Error(`Checksum mismatch! Expected: ${expectedHash}, Got: ${actualHash}`);
              }
            }
          }
        } catch (sumErr: any) {
          if (sumErr.message && sumErr.message.includes('Checksum mismatch')) {
            throw sumErr;
          }
          console.warn('[Updater] Checksum verification warning:', sumErr);
        }
      }

      // Rename temp file to target and make executable if AppImage
      if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
      fs.renameSync(tempFile, targetFile);

      if (format === 'appimage') {
        try { fs.chmodSync(targetFile, 0o755); } catch {}
      }

      this.downloadedUpdatePath = targetFile;
      this.downloadedVersion = releaseInfo.version;
      this.downloadedFormat = format;

      notify('ready', 100, `Downloaded ${asset.name}! Ready to install.`);
      return { success: true, filePath: targetFile, format };
    } catch (e: any) {
      notify('error', 0, `Download failed: ${e.message}`);
      return { success: false, error: e.message };
    } finally {
      this.isDownloading = false;
    }
  }

  public async installDebPackage(
    debPath: string,
    onProgress?: (p: UpdateProgress) => void
  ): Promise<{
    success: boolean;
    requiresRestart?: boolean;
    message?: string;
    installedPath?: string;
    manualCommand?: string;
    cancelled?: boolean;
    error?: string;
  }> {
    if (!fs.existsSync(debPath)) {
      return { success: false, error: `Debian package not found at: ${debPath}` };
    }

    const notify = (status: UpdateProgress['status'], progress: number, message: string) => {
      if (onProgress) onProgress({ status, progress, message });
    };

    notify('installing', 10, 'Prompting for administrator authentication to install package...');

    // Check if pkexec is installed
    const hasPkexec = fs.existsSync('/usr/bin/pkexec');
    if (!hasPkexec) {
      const cmd = `sudo apt install -y "${debPath}"`;
      notify('error', 0, 'pkexec (PolicyKit) not found. Manual installation required.');
      return {
        success: false,
        error: 'pkexec (PolicyKit) was not found on your system.',
        manualCommand: cmd
      };
    }

    return new Promise((resolve) => {
      // Use pkexec with apt install for full dependency resolution
      const child = spawn('pkexec', ['apt', 'install', '-y', '--reinstall', debPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (d) => {
        stdout += d.toString();
        notify('installing', 50, 'Configuring and installing Linux Jagex Launcher package...');
      });

      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            desktopIntegration.ensureAll();
          } catch (e) {
            console.warn('[Updater] desktopIntegration error post-install:', e);
          }
          notify('ready', 100, 'Package installed successfully to /usr/bin/jagex-launcher!');
          resolve({
            success: true,
            requiresRestart: true,
            installedPath: '/usr/bin/jagex-launcher',
            message: 'Installation successful! Restart the launcher to use the new version.'
          });
        } else if (code === 126 || code === 127) {
          const msg = 'Authentication was dismissed or cancelled.';
          notify('error', 0, msg);
          resolve({
            success: false,
            cancelled: true,
            error: msg,
            manualCommand: `sudo apt install "${debPath}"`
          });
        } else {
          // Fallback to dpkg -i
          console.warn(`[Updater] apt failed (exit code ${code}). Trying dpkg -i fallback... Output: ${stdout}`);
          notify('installing', 60, 'Retrying with dpkg...');
          const dpkgChild = spawn('pkexec', ['dpkg', '-i', debPath], {
            stdio: ['ignore', 'pipe', 'pipe']
          });

          let dpkgErr = '';
          dpkgChild.stderr?.on('data', (d) => { dpkgErr += d.toString(); });
          dpkgChild.on('close', (dpkgCode) => {
            if (dpkgCode === 0) {
              try { desktopIntegration.ensureAll(); } catch {}
              notify('ready', 100, 'Package installed successfully via dpkg!');
              resolve({
                success: true,
                requiresRestart: true,
                installedPath: '/usr/bin/jagex-launcher',
                message: 'Installation successful via dpkg!'
              });
            } else {
              const fullErr = dpkgErr || stderr || `Installer exited with code ${dpkgCode}`;
              notify('error', 0, `Installation failed: ${fullErr}`);
              resolve({
                success: false,
                error: fullErr,
                manualCommand: `sudo apt install "${debPath}"`
              });
            }
          });
          dpkgChild.on('error', (err) => {
            notify('error', 0, `dpkg launch error: ${err.message}`);
            resolve({
              success: false,
              error: err.message,
              manualCommand: `sudo apt install "${debPath}"`
            });
          });
        }
      });

      child.on('error', (err) => {
        notify('error', 0, `Failed to execute pkexec: ${err.message}`);
        resolve({
          success: false,
          error: err.message,
          manualCommand: `sudo apt install "${debPath}"`
        });
      });
    });
  }

  public async installSnapPackage(
    snapPath: string,
    onProgress?: (p: UpdateProgress) => void
  ): Promise<{
    success: boolean;
    requiresRestart?: boolean;
    message?: string;
    installedPath?: string;
    manualCommand?: string;
    cancelled?: boolean;
    error?: string;
  }> {
    if (!fs.existsSync(snapPath)) {
      return { success: false, error: `Snap package not found at: ${snapPath}` };
    }

    const notify = (status: UpdateProgress['status'], progress: number, message: string) => {
      if (onProgress) onProgress({ status, progress, message });
    };

    notify('installing', 10, 'Prompting for administrator authentication to install snap package...');

    const hasPkexec = fs.existsSync('/usr/bin/pkexec');
    if (!hasPkexec) {
      const cmd = `sudo snap install --dangerous "${snapPath}"`;
      notify('error', 0, 'pkexec (PolicyKit) not found. Manual installation required.');
      return {
        success: false,
        error: 'pkexec (PolicyKit) was not found on your system.',
        manualCommand: cmd
      };
    }

    return new Promise((resolve) => {
      const child = spawn('pkexec', ['snap', 'install', '--dangerous', snapPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      child.stderr?.on('data', (d) => {
        stderr += d.toString();
        notify('installing', 50, 'Configuring and installing Linux Jagex Launcher Snap...');
      });

      child.on('close', (code) => {
        if (code === 0) {
          notify('ready', 100, 'Snap package installed successfully!');
          resolve({
            success: true,
            requiresRestart: true,
            installedPath: '/snap/bin/linux-jagex-launcher',
            message: 'Installation successful! Restart the launcher to use the new version.'
          });
        } else if (code === 126 || code === 127) {
          const msg = 'Authentication was dismissed or cancelled.';
          notify('error', 0, msg);
          resolve({ success: false, cancelled: true, error: msg });
        } else {
          const err = stderr.trim() || `snap install process exited with status code ${code}`;
          notify('error', 0, `Installation failed: ${err}`);
          resolve({
            success: false,
            error: err,
            manualCommand: `sudo snap install --dangerous "${snapPath}"`
          });
        }
      });
    });
  }

  public async installAppImage(
    appImagePath: string,
    onProgress?: (p: UpdateProgress) => void
  ): Promise<{
    success: boolean;
    requiresRestart?: boolean;
    message?: string;
    installedPath?: string;
    error?: string;
  }> {
    const notify = (status: UpdateProgress['status'], progress: number, message: string) => {
      if (onProgress) onProgress({ status, progress, message });
    };

    try {
      notify('installing', 20, 'Preparing AppImage permissions...');
      fs.chmodSync(appImagePath, 0o755);

      const runningAppImage = process.env.APPIMAGE;
      let finalPath = appImagePath;

      if (runningAppImage && fs.existsSync(runningAppImage)) {
        notify('installing', 60, 'Updating existing AppImage in-place...');
        const backupPath = runningAppImage + '.old';
        try {
          if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
          fs.copyFileSync(appImagePath, runningAppImage);
          fs.chmodSync(runningAppImage, 0o755);
          finalPath = runningAppImage;
        } catch (copyErr: any) {
          console.warn(`[Updater] Could not overwrite running AppImage: ${copyErr.message}. Will use downloaded copy.`);
        }
      } else {
        const localBinDir = path.join(os.homedir(), '.local', 'bin');
        if (!fs.existsSync(localBinDir)) {
          try { fs.mkdirSync(localBinDir, { recursive: true }); } catch {}
        }
        const binDest = path.join(localBinDir, 'jagex-launcher');
        try {
          fs.copyFileSync(appImagePath, binDest);
          fs.chmodSync(binDest, 0o755);
          finalPath = binDest;
        } catch {
          // If copying to ~/.local/bin fails, keep using appImagePath
        }
      }

      // Refresh desktop shortcuts and dock icons
      try {
        desktopIntegration.ensureAll();
      } catch (deskErr) {
        console.warn('[Updater] desktopIntegration error post-install:', deskErr);
      }

      notify('ready', 100, `AppImage installed successfully to ${finalPath}!`);
      return {
        success: true,
        requiresRestart: true,
        installedPath: finalPath,
        message: `AppImage installed successfully! Ready to restart.`
      };
    } catch (e: any) {
      notify('error', 0, `AppImage installation failed: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  public async installUpdate(
    filePath?: string,
    format?: PackageFormat,
    onProgress?: (p: UpdateProgress) => void
  ): Promise<{
    success: boolean;
    requiresRestart?: boolean;
    message?: string;
    installedPath?: string;
    manualCommand?: string;
    cancelled?: boolean;
    error?: string;
  }> {
    if (this.isInstalling) {
      return { success: false, error: 'An installation is already in progress.' };
    }

    const targetFile = filePath || this.downloadedUpdatePath;
    const targetFormat = format || this.downloadedFormat || this.getPackageFormat();

    if (!targetFile || !fs.existsSync(targetFile)) {
      return { success: false, error: 'No downloaded update file found to install.' };
    }

    this.isInstalling = true;
    try {
      if (targetFormat === 'deb') {
        return await this.installDebPackage(targetFile, onProgress);
      } else if (targetFormat === 'snap') {
        return await this.installSnapPackage(targetFile, onProgress);
      } else if (targetFormat === 'appimage') {
        return await this.installAppImage(targetFile, onProgress);
      } else {
        return {
          success: false,
          error: `Automated installer for format "${targetFormat}" is not supported. Please install ${targetFile} manually.`
        };
      }
    } finally {
      this.isInstalling = false;
    }
  }

  public applyUpdateAndRestart(): boolean {
    console.log(`[Updater] Preparing to apply update and restart`);

    // Check if system deb binary exists
    if (this.downloadedFormat === 'deb' && fs.existsSync('/usr/bin/jagex-launcher')) {
      try {
        const child = spawn('/usr/bin/jagex-launcher', process.argv.slice(1), {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        if (app && typeof app.exit === 'function') {
          app.exit(0);
          return true;
        }
      } catch (e: any) {
        console.warn('[Updater] Failed to spawn /usr/bin/jagex-launcher:', e.message);
      }
    }

    const currentAppImage = process.env.APPIMAGE;
    if (currentAppImage && fs.existsSync(currentAppImage)) {
      if (app && typeof app.relaunch === 'function' && typeof app.exit === 'function') {
        app.relaunch({ execPath: currentAppImage });
        app.exit(0);
        return true;
      }
    }

    if (this.downloadedUpdatePath && fs.existsSync(this.downloadedUpdatePath)) {
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
      if (app && typeof app.quit === 'function') app.quit();
      return true;
    }

    if (app && typeof app.relaunch === 'function' && typeof app.exit === 'function') {
      app.relaunch();
      app.exit(0);
      return true;
    }

    return false;
  }
}

export const updater = new AutoUpdater();

