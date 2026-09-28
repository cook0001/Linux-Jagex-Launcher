import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';

const PACKAGES_URL = 'https://content.runescape.com/downloads/ubuntu/dists/trusty/non-free/binary-amd64/Packages';
const BASE_CONTENT_URL = 'https://content.runescape.com/downloads/ubuntu/';

export interface PackageMetadata {
  packageName: string;
  version: string;
  filename: string;
  size: number;
  sha256: string;
}

export interface InstallProgress {
  status: 'checking' | 'downloading' | 'extracting' | 'ready' | 'error';
  progress: number; // 0 to 100
  message: string;
}

export class Rs3Installer {
  private baseDir: string;
  private clientDir: string;
  private gameDataDir: string;
  private metadataFile: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), '.local', 'share', 'linux-jagex-launcher');
    this.clientDir = path.join(this.baseDir, 'client');
    this.gameDataDir = path.join(this.baseDir, 'game-data');
    this.metadataFile = path.join(this.baseDir, 'version.json');

    if (!fs.existsSync(this.clientDir)) fs.mkdirSync(this.clientDir, { recursive: true });
    if (!fs.existsSync(this.gameDataDir)) fs.mkdirSync(this.gameDataDir, { recursive: true });
  }

  public getClientExecutablePath(): string {
    return path.join(this.clientDir, 'usr', 'share', 'games', 'runescape-launcher', 'runescape');
  }

  public getGameDataDir(): string {
    return this.gameDataDir;
  }

  public getInstalledHash(): string | null {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
        return data.sha256 || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  public setInstalledHash(sha256: string, version: string) {
    try {
      fs.writeFileSync(this.metadataFile, JSON.stringify({ sha256, version, installedAt: Date.now() }, null, 2), 'utf8');
    } catch (e) {
      console.error('[Installer] Failed to record installed hash:', e);
    }
  }

  public async checkLatestPackage(): Promise<PackageMetadata> {
    const res = await fetch(PACKAGES_URL, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to fetch Packages list: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    const map: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const idx = line.indexOf(': ');
      if (idx !== -1) {
        const key = line.substring(0, idx).trim();
        const val = line.substring(idx + 2).trim();
        map[key] = val;
      }
    }

    if (!map.Filename || !map.SHA256) {
      throw new Error('Invalid package metadata received from Jagex server');
    }

    return {
      packageName: map.Package || 'runescape-launcher',
      version: map.Version || '2.2.12',
      filename: map.Filename,
      size: parseInt(map.Size || '0', 10),
      sha256: map.SHA256,
    };
  }

  public async isInstalledAndUpToDate(): Promise<boolean> {
    const binary = this.getClientExecutablePath();
    if (!fs.existsSync(binary)) return false;

    try {
      const latest = await this.checkLatestPackage();
      const current = this.getInstalledHash();
      return current === latest.sha256;
    } catch (e) {
      // If offline, check if binary exists
      return fs.existsSync(binary);
    }
  }

  public async installOrUpdate(onProgress?: (p: InstallProgress) => void): Promise<string> {
    const notify = (status: InstallProgress['status'], progress: number, message: string) => {
      if (onProgress) onProgress({ status, progress, message });
    };

    notify('checking', 0, 'Checking for updates...');
    const meta = await this.checkLatestPackage();
    const currentHash = this.getInstalledHash();
    const binaryPath = this.getClientExecutablePath();

    if (currentHash === meta.sha256 && fs.existsSync(binaryPath)) {
      notify('ready', 100, 'RuneScape 3 is up to date.');
      return binaryPath;
    }

    const debUrl = BASE_CONTENT_URL + meta.filename;
    notify('downloading', 0, `Downloading RuneScape client (${(meta.size / 1024 / 1024).toFixed(1)} MB)...`);

    const res = await fetch(debUrl);
    if (!res.ok) {
      throw new Error(`Failed to download .deb (${res.status}): ${res.statusText}`);
    }

    const totalBytes = meta.size || parseInt(res.headers.get('content-length') || '0', 10);
    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('No response stream available for client download');
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedBytes += value.length;
        const pct = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 50;
        notify('downloading', pct, `Downloading client: ${pct}%`);
      }
    }

    const debBuffer = Buffer.concat(chunks);
    const calculatedHash = crypto.createHash('sha256').update(debBuffer).digest('hex');

    if (calculatedHash !== meta.sha256) {
      notify('error', 0, 'Checksum verification failed');
      throw new Error(`Checksum mismatch! Expected: ${meta.sha256}, Got: ${calculatedHash}`);
    }

    notify('extracting', 90, 'Extracting client files...');
    await this.extractDeb(debBuffer);

    // Verify binary
    if (fs.existsSync(binaryPath)) {
      fs.chmodSync(binaryPath, 0o755);
    } else {
      throw new Error('Executable was not found after extraction');
    }

    this.setInstalledHash(meta.sha256, meta.version);
    notify('ready', 100, 'Installation complete!');
    return binaryPath;
  }

  private async extractDeb(debBuffer: Buffer): Promise<void> {
    // 1. Locate data.tar.xz within ar archive
    const dataTarXz = this.extractMemberFromAr(debBuffer, 'data.tar.xz');
    if (!dataTarXz) {
      throw new Error('data.tar.xz not found in .deb archive');
    }

    // 2. Unpack data.tar.xz using system tar into clientDir
    const tempTarPath = path.join(this.baseDir, 'temp_data.tar.xz');
    fs.writeFileSync(tempTarPath, dataTarXz);

    try {
      await new Promise<void>((resolve, reject) => {
        const tarProc = spawn('tar', ['-xf', tempTarPath, '-C', this.clientDir]);
        tarProc.on('error', (err) => reject(err));
        tarProc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`tar extraction failed with exit code ${code}`));
        });
      });
    } finally {
      if (fs.existsSync(tempTarPath)) {
        fs.unlinkSync(tempTarPath);
      }
    }
  }

  private extractMemberFromAr(buffer: Buffer, targetName: string): Buffer | null {
    // ar archive begins with "!<arch>\n" (8 bytes)
    const magic = buffer.subarray(0, 8).toString('ascii');
    if (magic !== '!<arch>\n') {
      throw new Error('Not a valid ar archive (.deb header missing)');
    }

    let offset = 8;
    while (offset + 60 <= buffer.length) {
      const header = buffer.subarray(offset, offset + 60);
      const name = header.subarray(0, 16).toString('ascii').trim().replace(/\/$/, '');
      const sizeStr = header.subarray(48, 58).toString('ascii').trim();
      const size = parseInt(sizeStr, 10);

      offset += 60;
      if (name.startsWith(targetName)) {
        return buffer.subarray(offset, offset + size);
      }

      // ar offsets are 2-byte aligned
      offset += size + (size % 2);
    }
    return null;
  }
}

export const installer = new Rs3Installer();
