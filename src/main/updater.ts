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

export type PackageFormat = 'appimage' | 'flatpak' | 'snap' | 'deb' | 'rpm' | 'pacman' | 'aur' | 'tar' | 'dev';

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
    rpm?: ReleaseAsset;
    pacman?: ReleaseAsset;
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
  supportedFormats: ('appimage' | 'deb' | 'rpm' | 'pacman' | 'snap' | 'tar')[];
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
  private installedBinaryPath: string | null = null;
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
    if (fs.existsSync('/etc/fedora-release') || fs.existsSync('/etc/redhat-release')) {
      if (fs.existsSync('/opt/Jagex Launcher')) return 'rpm';
    }
    if (fs.existsSync('/etc/arch-release')) {
      if (fs.existsSync('/opt/Jagex Launcher')) return 'pacman';
    }
    if (typeof app === 'undefined' || !app || !app.isPackaged) return 'dev';
    return 'tar';
  }

  public getSystemFamily(): 'debian' | 'arch' | 'fedora' | 'unknown' {
    if (fs.existsSync('/etc/debian_version')) return 'debian';
    if (fs.existsSync('/etc/arch-release')) return 'arch';
    if (fs.existsSync('/etc/fedora-release') || fs.existsSync('/etc/redhat-release')) return 'fedora';
    return 'unknown';
  }

  public getCurrentVersion(): string {
    if (typeof app !== 'undefined' && app && typeof app.getVersion === 'function') {
      return app.getVersion() || '1.4.4';
    }
    return '1.4.4';
  }

  public getFormatDisplayLabel(format?: PackageFormat): string {
    const f = format || this.getPackageFormat();
    switch (f) {
      case 'appimage': return 'AppImage (Direct In-App Updates)';
      case 'flatpak': return 'Flatpak / Flathub';
      case 'snap': return 'Snap (Managed by Snapd)';
      case 'deb': return 'Debian / Ubuntu (.deb)';
      case 'rpm': return 'Fedora / RHEL (.rpm)';
      case 'pacman': return 'Arch Linux (.pacman)';
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
          } else if (name.endsWith('.rpm')) {
            assets.rpm = { name, url: a.browser_download_url, size: a.size };
          } else if (name.endsWith('.pacman')) {
            assets.pacman = { name, url: a.browser_download_url, size: a.size };
          } else if (name.endsWith('.tar.gz')) {
            assets.tar = { name, url: a.browser_download_url, size: a.size };
          } else if (name.endsWith('.snap')) {
            assets.snap = { name, url: a.browser_download_url, size: a.size };
          } else if (name.includes('SHA256SUMS') || name.endsWith('.sha256')) {
            assets.checksums = { name, url: a.browser_download_url, size: a.size };
          }
        }
      }

      const supportedFormats: ('appimage' | 'deb' | 'rpm' | 'pacman' | 'snap' | 'tar')[] = [];
      if (assets.appImage) supportedFormats.push('appimage');
      if (assets.deb) supportedFormats.push('deb');
      if (assets.rpm) supportedFormats.push('rpm');
      if (assets.pacman) supportedFormats.push('pacman');
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
      if (currentFormat === 'appimage' && releaseInfo.assets.appImage) {
        format = 'appimage';
      } else if ((currentFormat === 'deb' || systemFamily === 'debian') && releaseInfo.assets.deb) {
        format = 'deb';
      } else if ((currentFormat === 'rpm' || systemFamily === 'fedora') && releaseInfo.assets.rpm) {
        format = 'rpm';
      } else if ((currentFormat === 'pacman' || currentFormat === 'aur' || systemFamily === 'arch') && releaseInfo.assets.pacman) {
        format = 'pacman';
      } else if (currentFormat === 'snap' && releaseInfo.assets.snap) {
        format = 'snap';
      } else if (releaseInfo.assets.appImage) {
        format = 'appimage';
      } else if (releaseInfo.assets.deb) {
        format = 'deb';
      } else if (releaseInfo.assets.rpm) {
        format = 'rpm';
      } else if (releaseInfo.assets.pacman) {
        format = 'pacman';
      } else if (releaseInfo.assets.snap) {
        format = 'snap';
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
      } else if (format === 'rpm') {
        asset = releaseInfo.assets.rpm;
        if (!asset) throw new Error('RPM package asset (.rpm) not found in latest GitHub release.');
        targetFileName = asset.name || `linux-jagex-launcher-${releaseInfo.version}.x86_64.rpm`;
      } else if (format === 'pacman') {
        asset = releaseInfo.assets.pacman;
        if (!asset) throw new Error('Pacman package asset (.pacman) not found in latest GitHub release.');
        targetFileName = asset.name || `linux-jagex-launcher-${releaseInfo.version}.x64.pacman`;
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
        } else if (releaseInfo.assets.rpm) {
          format = 'rpm';
          asset = releaseInfo.assets.rpm;
          targetFileName = releaseInfo.assets.rpm.name;
        } else if (releaseInfo.assets.pacman) {
          format = 'pacman';
          asset = releaseInfo.assets.pacman;
          targetFileName = releaseInfo.assets.pacman.name;
        } else if (releaseInfo.assets.snap) {
          format = 'snap';
          asset = releaseInfo.assets.snap;
          targetFileName = releaseInfo.assets.snap.name;
        } else if (releaseInfo.assets.tar) {
          format = 'tar';
          asset = releaseInfo.assets.tar;
          targetFileName = releaseInfo.assets.tar.name;
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
          const debBinCandidates = [
            '/usr/bin/linux-jagex-launcher',
            '/opt/Jagex Launcher/linux-jagex-launcher',
            '/usr/bin/jagex-launcher'
          ];
          const installedPath = debBinCandidates.find(p => fs.existsSync(p)) || '/usr/bin/linux-jagex-launcher';
          this.installedBinaryPath = installedPath;

          notify('ready', 100, `Package installed successfully to ${installedPath}!`);
          resolve({
            success: true,
            requiresRestart: true,
            installedPath,
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
              const debBinCandidates = [
                '/usr/bin/linux-jagex-launcher',
                '/opt/Jagex Launcher/linux-jagex-launcher',
                '/usr/bin/jagex-launcher'
              ];
              const installedPath = debBinCandidates.find(p => fs.existsSync(p)) || '/usr/bin/linux-jagex-launcher';
              this.installedBinaryPath = installedPath;

              notify('ready', 100, `Package installed successfully to ${installedPath}!`);
              resolve({
                success: true,
                requiresRestart: true,
                installedPath,
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

  public async installRpmPackage(
    rpmPath: string,
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
    if (!fs.existsSync(rpmPath)) {
      return { success: false, error: `RPM package not found at: ${rpmPath}` };
    }

    const notify = (status: UpdateProgress['status'], progress: number, message: string) => {
      if (onProgress) onProgress({ status, progress, message });
    };

    notify('installing', 10, 'Prompting for administrator authentication to install RPM package...');

    const hasPkexec = fs.existsSync('/usr/bin/pkexec');
    if (!hasPkexec) {
      const cmd = `sudo dnf install -y "${rpmPath}" || sudo rpm -Uvh "${rpmPath}"`;
      notify('error', 0, 'pkexec (PolicyKit) not found. Manual installation required.');
      return {
        success: false,
        error: 'pkexec (PolicyKit) was not found on your system.',
        manualCommand: cmd
      };
    }

    return new Promise((resolve) => {
      const isDnf = fs.existsSync('/usr/bin/dnf');
      const bin = isDnf ? 'dnf' : 'rpm';
      const args = isDnf ? ['install', '-y', '--nogpgcheck', rpmPath] : ['-Uvh', '--replacepkgs', rpmPath];

      const child = spawn('pkexec', [bin, ...args], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (d) => {
        stdout += d.toString();
        notify('installing', 50, 'Configuring and installing Linux Jagex Launcher RPM package...');
      });

      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          try { desktopIntegration.ensureAll(); } catch {}
          const rpmBinCandidates = [
            '/usr/bin/linux-jagex-launcher',
            '/opt/Jagex Launcher/linux-jagex-launcher',
            '/usr/bin/jagex-launcher'
          ];
          const installedPath = rpmBinCandidates.find(p => fs.existsSync(p)) || '/usr/bin/linux-jagex-launcher';
          this.installedBinaryPath = installedPath;

          notify('ready', 100, `RPM package installed successfully to ${installedPath}!`);
          resolve({
            success: true,
            requiresRestart: true,
            installedPath,
            message: 'RPM installation successful! Restart the launcher to use the new version.'
          });
        } else if (code === 126 || code === 127) {
          const msg = 'Authentication was dismissed or cancelled.';
          notify('error', 0, msg);
          resolve({
            success: false,
            cancelled: true,
            error: msg,
            manualCommand: `sudo dnf install "${rpmPath}"`
          });
        } else {
          const err = stderr.trim() || stdout.trim() || `Installer exited with code ${code}`;
          notify('error', 0, `Installation failed: ${err}`);
          resolve({
            success: false,
            error: err,
            manualCommand: `sudo dnf install "${rpmPath}"`
          });
        }
      });

      child.on('error', (err) => {
        notify('error', 0, `Failed to execute pkexec: ${err.message}`);
        resolve({
          success: false,
          error: err.message,
          manualCommand: `sudo dnf install "${rpmPath}"`
        });
      });
    });
  }

  public async installPacmanPackage(
    pacmanPath: string,
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
    if (!fs.existsSync(pacmanPath)) {
      return { success: false, error: `Pacman package not found at: ${pacmanPath}` };
    }

    const notify = (status: UpdateProgress['status'], progress: number, message: string) => {
      if (onProgress) onProgress({ status, progress, message });
    };

    notify('installing', 10, 'Prompting for administrator authentication to install package...');

    const hasPkexec = fs.existsSync('/usr/bin/pkexec');
    if (!hasPkexec) {
      const cmd = `sudo pacman -U --noconfirm "${pacmanPath}"`;
      notify('error', 0, 'pkexec (PolicyKit) not found. Manual installation required.');
      return {
        success: false,
        error: 'pkexec (PolicyKit) was not found on your system.',
        manualCommand: cmd
      };
    }

    return new Promise((resolve) => {
      const child = spawn('pkexec', ['pacman', '-U', '--noconfirm', pacmanPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      child.stderr?.on('data', (d) => {
        stderr += d.toString();
        notify('installing', 50, 'Configuring and installing Linux Jagex Launcher pacman package...');
      });

      child.on('close', (code) => {
        if (code === 0) {
          try { desktopIntegration.ensureAll(); } catch {}
          const binCandidates = [
            '/usr/bin/linux-jagex-launcher',
            '/opt/Jagex Launcher/linux-jagex-launcher',
            '/usr/bin/jagex-launcher'
          ];
          const installedPath = binCandidates.find(p => fs.existsSync(p)) || '/usr/bin/linux-jagex-launcher';
          this.installedBinaryPath = installedPath;

          notify('ready', 100, `Pacman package installed successfully to ${installedPath}!`);
          resolve({
            success: true,
            requiresRestart: true,
            installedPath,
            message: 'Pacman installation successful! Restart the launcher to use the new version.'
          });
        } else if (code === 126 || code === 127) {
          const msg = 'Authentication was dismissed or cancelled.';
          notify('error', 0, msg);
          resolve({
            success: false,
            cancelled: true,
            error: msg,
            manualCommand: `sudo pacman -U "${pacmanPath}"`
          });
        } else {
          const err = stderr.trim() || `pacman exited with status code ${code}`;
          notify('error', 0, `Installation failed: ${err}`);
          resolve({
            success: false,
            error: err,
            manualCommand: `sudo pacman -U "${pacmanPath}"`
          });
        }
      });

      child.on('error', (err) => {
        notify('error', 0, `Failed to execute pkexec: ${err.message}`);
        resolve({
          success: false,
          error: err.message,
          manualCommand: `sudo pacman -U "${pacmanPath}"`
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
          this.installedBinaryPath = '/snap/bin/linux-jagex-launcher';
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

  public async installTarPackage(
    tarPath: string,
    onProgress?: (p: UpdateProgress) => void
  ): Promise<{
    success: boolean;
    requiresRestart?: boolean;
    message?: string;
    installedPath?: string;
    error?: string;
  }> {
    if (!fs.existsSync(tarPath)) {
      return { success: false, error: `Tarball not found at: ${tarPath}` };
    }

    const notify = (status: UpdateProgress['status'], progress: number, message: string) => {
      if (onProgress) onProgress({ status, progress, message });
    };

    notify('installing', 20, 'Extracting standalone archive...');

    const destDir = path.join(os.homedir(), '.local', 'share', 'linux-jagex-launcher', 'app');
    if (!fs.existsSync(destDir)) {
      try { fs.mkdirSync(destDir, { recursive: true }); } catch {}
    }

    return new Promise((resolve) => {
      const child = spawn('tar', ['-xzf', tarPath, '-C', destDir], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      child.stderr?.on('data', (d) => { stderr += d.toString(); });

      child.on('close', (code) => {
        if (code === 0) {
          const binCandidates = [
            path.join(destDir, 'linux-jagex-launcher'),
            path.join(destDir, 'jagex-launcher')
          ];
          const binPath = binCandidates.find(p => fs.existsSync(p)) || path.join(destDir, 'linux-jagex-launcher');
          if (fs.existsSync(binPath)) {
            try { fs.chmodSync(binPath, 0o755); } catch {}
          }
          const localBin = path.join(os.homedir(), '.local', 'bin');
          if (!fs.existsSync(localBin)) {
            try { fs.mkdirSync(localBin, { recursive: true }); } catch {}
          }
          const symlinkPath = path.join(localBin, 'linux-jagex-launcher');
          try {
            if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
            fs.symlinkSync(binPath, symlinkPath);
          } catch {}

          this.installedBinaryPath = binPath;
          try { desktopIntegration.ensureAll(); } catch {}

          notify('ready', 100, 'Tarball extracted and configured successfully!');
          resolve({
            success: true,
            requiresRestart: true,
            installedPath: binPath,
            message: 'Extracted standalone build successfully! Ready to restart.'
          });
        } else {
          const err = stderr.trim() || `tar exited with code ${code}`;
          notify('error', 0, `Extraction failed: ${err}`);
          resolve({ success: false, error: err });
        }
      });

      child.on('error', (err) => {
        notify('error', 0, `Failed to extract tar: ${err.message}`);
        resolve({ success: false, error: err.message });
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

        // Linux atomic replacement pattern to resolve ETXTBSY (text file is busy):
        // 1. Rename runningAppImage -> runningAppImage.old (unlinks running inode from directory entry)
        // 2. Copy the new AppImage to runningAppImage path
        // 3. Chmod 0755
        // 4. Remove backup file
        try {
          if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
          fs.renameSync(runningAppImage, backupPath);
          fs.copyFileSync(appImagePath, runningAppImage);
          fs.chmodSync(runningAppImage, 0o755);
          try { fs.unlinkSync(backupPath); } catch {}
          finalPath = runningAppImage;
        } catch (copyErr: any) {
          console.warn(`[Updater] Atomic rename/copy on running AppImage failed: ${copyErr.message}. Restoring backup if needed.`);
          if (!fs.existsSync(runningAppImage) && fs.existsSync(backupPath)) {
            try { fs.renameSync(backupPath, runningAppImage); } catch {}
          }
          finalPath = appImagePath;
        }

        // Also save the newly versioned AppImage in the same directory (e.g., ~/Downloads/Jagex-Launcher-1.4.4.AppImage)
        try {
          const parentDir = path.dirname(runningAppImage);
          const versionedPath = path.join(parentDir, path.basename(appImagePath));
          if (versionedPath !== runningAppImage) {
            fs.copyFileSync(appImagePath, versionedPath);
            fs.chmodSync(versionedPath, 0o755);
            finalPath = versionedPath;
          }
        } catch (versionedErr: any) {
          console.warn('[Updater] Could not place versioned AppImage into directory:', versionedErr.message);
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
          finalPath = appImagePath;
        }
      }

      this.installedBinaryPath = finalPath;
      this.downloadedUpdatePath = finalPath;

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
      } else if (targetFormat === 'rpm') {
        return await this.installRpmPackage(targetFile, onProgress);
      } else if (targetFormat === 'pacman') {
        return await this.installPacmanPackage(targetFile, onProgress);
      } else if (targetFormat === 'snap') {
        return await this.installSnapPackage(targetFile, onProgress);
      } else if (targetFormat === 'tar') {
        return await this.installTarPackage(targetFile, onProgress);
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

    // Priority 1: Newly installed binary registered during update
    if (this.installedBinaryPath && fs.existsSync(this.installedBinaryPath)) {
      try {
        console.log(`[Updater] Launching installed binary: ${this.installedBinaryPath}`);
        if (this.downloadedFormat === 'appimage' && app && typeof app.relaunch === 'function' && typeof app.exit === 'function') {
          app.relaunch({ execPath: this.installedBinaryPath });
          app.exit(0);
          return true;
        }

        const child = spawn(this.installedBinaryPath, process.argv.slice(1), {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        if (app && typeof app.exit === 'function') {
          app.exit(0);
          return true;
        }
        if (app && typeof app.quit === 'function') {
          app.quit();
          return true;
        }
      } catch (e: any) {
        console.warn(`[Updater] Failed to launch installedBinaryPath (${this.installedBinaryPath}):`, e.message);
      }
    }

    // Priority 2: System installed package binary for deb / rpm / pacman
    if (['deb', 'rpm', 'pacman'].includes(this.downloadedFormat || '')) {
      const candidates = [
        '/usr/bin/linux-jagex-launcher',
        '/opt/Jagex Launcher/linux-jagex-launcher',
        '/usr/bin/jagex-launcher'
      ];
      for (const bin of candidates) {
        if (fs.existsSync(bin)) {
          try {
            console.log(`[Updater] Spawning system package binary: ${bin}`);
            const child = spawn(bin, process.argv.slice(1), {
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            if (app && typeof app.exit === 'function') {
              app.exit(0);
              return true;
            }
          } catch (e: any) {
            console.warn(`[Updater] Failed to spawn package candidate (${bin}):`, e.message);
          }
        }
      }
    }

    // Priority 3: Snap binary
    if (this.downloadedFormat === 'snap' && fs.existsSync('/snap/bin/linux-jagex-launcher')) {
      try {
        const child = spawn('/snap/bin/linux-jagex-launcher', process.argv.slice(1), {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        if (app && typeof app.exit === 'function') {
          app.exit(0);
          return true;
        }
      } catch {}
    }

    // Priority 4: AppImage relaunch (only when AppImage was the target format)
    const currentAppImage = process.env.APPIMAGE;
    if (this.downloadedFormat === 'appimage') {
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
      if (currentAppImage && fs.existsSync(currentAppImage)) {
        if (app && typeof app.relaunch === 'function' && typeof app.exit === 'function') {
          app.relaunch({ execPath: currentAppImage });
          app.exit(0);
          return true;
        }
      }
    }

    // Fallback: electron standard relaunch
    if (app && typeof app.relaunch === 'function' && typeof app.exit === 'function') {
      app.relaunch();
      app.exit(0);
      return true;
    }

    return false;
  }
}

export const updater = new AutoUpdater();
