import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';

const PACKAGES_URL = 'https://content.runescape.com/downloads/ubuntu/dists/trusty/non-free/binary-amd64/Packages';
const BASE_CONTENT_URL = 'https://content.runescape.com/downloads/ubuntu/';

// Canonical Ubuntu security archive package for OpenSSL 1.1 (libssl1.1)
const LIBSSL_DEB_URLS = [
  'http://security.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.24_amd64.deb',
  'http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.24_amd64.deb'
];
const LIBSSL_DEB_SHA256 = '7cf39d70a639017d1dd7c8d36daa2258063608688e449fddf40ffdd46f992a78';

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
  private compatLibDir: string;
  private metadataFile: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), '.local', 'share', 'linux-jagex-launcher');
    this.clientDir = path.join(this.baseDir, 'client');
    this.gameDataDir = path.join(this.baseDir, 'game-data');
    this.compatLibDir = path.join(this.baseDir, 'compat', 'lib64');
    this.metadataFile = path.join(this.baseDir, 'version.json');

    if (!fs.existsSync(this.clientDir)) fs.mkdirSync(this.clientDir, { recursive: true });
    if (!fs.existsSync(this.gameDataDir)) fs.mkdirSync(this.gameDataDir, { recursive: true });
    if (!fs.existsSync(this.compatLibDir)) fs.mkdirSync(this.compatLibDir, { recursive: true });
  }

  public getClientExecutablePath(): string {
    return path.join(this.clientDir, 'usr', 'share', 'games', 'runescape-launcher', 'runescape');
  }

  public getGameDataDir(): string {
    return this.gameDataDir;
  }

  public getCompatLibDir(): string {
    return this.compatLibDir;
  }

  public isLibSslAvailable(): boolean {
    // 1. Check if our isolated compat directory already has the required libraries
    const compatSsl = path.join(this.compatLibDir, 'libssl.so.1.1');
    const compatCrypto = path.join(this.compatLibDir, 'libcrypto.so.1.1');
    if (fs.existsSync(compatSsl) && fs.existsSync(compatCrypto)) {
      return true;
    }

    // 2. Check standard system library search paths
    const systemDirs = [
      '/usr/lib/x86_64-linux-gnu',
      '/usr/lib64',
      '/usr/lib',
      '/lib/x86_64-linux-gnu',
      '/lib64',
      '/app/lib' // Flatpak sandbox runtime
    ];

    for (const dir of systemDirs) {
      const sslPath = path.join(dir, 'libssl.so.1.1');
      const cryptoPath = path.join(dir, 'libcrypto.so.1.1');
      try {
        if (fs.existsSync(sslPath) && fs.existsSync(cryptoPath)) {
          return true;
        }
      } catch {
        // Skip inaccessible dirs
      }
    }

    return false;
  }

  public async installLibSslCompat(onProgress?: (p: InstallProgress) => void): Promise<string> {
    const notify = (status: InstallProgress['status'], progress: number, message: string) => {
      if (onProgress) onProgress({ status, progress, message });
    };

    const targetSsl = path.join(this.compatLibDir, 'libssl.so.1.1');
    const targetCrypto = path.join(this.compatLibDir, 'libcrypto.so.1.1');

    if (fs.existsSync(targetSsl) && fs.existsSync(targetCrypto)) {
      notify('ready', 100, 'OpenSSL 1.1 compatibility libraries ready.');
      return this.compatLibDir;
    }

    notify('downloading', 10, 'Downloading OpenSSL 1.1 compatibility package (1.3 MB)...');

    let debBuffer: Buffer | null = null;
    let lastError: Error | null = null;

    for (const url of LIBSSL_DEB_URLS) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arrayBuf = await res.arrayBuffer();
        debBuffer = Buffer.from(arrayBuf);
        break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!debBuffer) {
      throw new Error(`Failed to download OpenSSL 1.1 compat deb: ${lastError?.message || 'Network error'}`);
    }

    const calculatedHash = crypto.createHash('sha256').update(debBuffer).digest('hex');
    if (calculatedHash !== LIBSSL_DEB_SHA256) {
      throw new Error(`OpenSSL compat checksum mismatch! Expected: ${LIBSSL_DEB_SHA256}, Got: ${calculatedHash}`);
    }

    notify('extracting', 70, 'Extracting libssl.so.1.1 and libcrypto.so.1.1 into isolated compat folder...');

    // Extract member data.tar.xz from .deb
    const dataTar = this.extractMemberFromAr(debBuffer, 'data.tar');
    if (!dataTar) {
      throw new Error('data.tar not found in OpenSSL 1.1 deb archive');
    }

    const tempExtractDir = path.join(this.baseDir, 'temp_ssl_extract');
    const tempTarPath = path.join(this.baseDir, 'temp_ssl.tar.xz');
    fs.mkdirSync(tempExtractDir, { recursive: true });
    fs.writeFileSync(tempTarPath, dataTar);

    try {
      await new Promise<void>((resolve, reject) => {
        const tarProc = spawn('tar', ['-xf', tempTarPath, '-C', tempExtractDir]);
        tarProc.on('error', (err) => reject(err));
        tarProc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`OpenSSL tar extraction failed with exit code ${code}`));
        });
      });

      // Find libssl.so.1.1 and libcrypto.so.1.1 inside tempExtractDir
      const candidates = [
        path.join(tempExtractDir, 'usr', 'lib', 'x86_64-linux-gnu'),
        path.join(tempExtractDir, 'usr', 'lib64'),
        path.join(tempExtractDir, 'usr', 'lib'),
        path.join(tempExtractDir, 'lib', 'x86_64-linux-gnu'),
        path.join(tempExtractDir, 'lib')
      ];

      let foundSsl: string | null = null;
      let foundCrypto: string | null = null;

      for (const dir of candidates) {
        const ssl = path.join(dir, 'libssl.so.1.1');
        const cryptoPath = path.join(dir, 'libcrypto.so.1.1');
        if (fs.existsSync(ssl) && !foundSsl) foundSsl = ssl;
        if (fs.existsSync(cryptoPath) && !foundCrypto) foundCrypto = cryptoPath;
      }

      if (!foundSsl || !foundCrypto) {
        throw new Error('Could not locate libssl.so.1.1 or libcrypto.so.1.1 within extracted deb package.');
      }

      fs.copyFileSync(foundSsl, targetSsl);
      fs.copyFileSync(foundCrypto, targetCrypto);
      fs.chmodSync(targetSsl, 0o755);
      fs.chmodSync(targetCrypto, 0o755);

      notify('ready', 100, 'OpenSSL 1.1 compatibility libraries installed successfully.');
      return this.compatLibDir;
    } finally {
      if (fs.existsSync(tempTarPath)) fs.unlinkSync(tempTarPath);
      if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
  }

  public clearClientCache(): { cleared: string[]; errors: string[] } {
    const cleared: string[] = [];
    const errors: string[] = [];

    const candidates = [
      path.join(os.homedir(), '.jagex_launcher'),
      path.join(os.homedir(), '.jagex_cache_32'),
      path.join(this.gameDataDir, 'jagexcache'),
      path.join(this.gameDataDir, '.jagex_launcher'),
      path.join(this.gameDataDir, 'RuneScape')
    ];

    for (const dir of candidates) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
          cleared.push(dir);
        } catch (e: any) {
          errors.push(`${dir}: ${e.message}`);
        }
      }
    }

    return { cleared, errors };
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
    } catch {
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
      // Ensure compat libraries are in place even if the client itself is up to date
      if (!this.isLibSslAvailable()) {
        try {
          await this.installLibSslCompat(onProgress);
        } catch (compatErr) {
          console.warn('[Installer] Note: Could not auto-install libssl1.1 compat libraries:', compatErr);
        }
      }
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
        const pct = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 80) : 40;
        notify('downloading', pct, `Downloading client: ${pct}%`);
      }
    }

    const debBuffer = Buffer.concat(chunks);
    const calculatedHash = crypto.createHash('sha256').update(debBuffer).digest('hex');

    if (calculatedHash !== meta.sha256) {
      notify('error', 0, 'Checksum verification failed');
      throw new Error(`Checksum mismatch! Expected: ${meta.sha256}, Got: ${calculatedHash}`);
    }

    notify('extracting', 85, 'Extracting client files...');
    await this.extractDeb(debBuffer);

    // Verify binary
    if (fs.existsSync(binaryPath)) {
      fs.chmodSync(binaryPath, 0o755);
    } else {
      throw new Error('Executable was not found after extraction');
    }

    // Ensure libssl1.1 compatibility libraries exist for Ubuntu 22.04+ / modern Linux distros
    if (!this.isLibSslAvailable()) {
      notify('downloading', 92, 'Installing OpenSSL 1.1 compatibility libraries for RS3...');
      try {
        await this.installLibSslCompat(onProgress);
      } catch (compatErr) {
        console.warn('[Installer] Note: Could not auto-install libssl1.1 compat libraries:', compatErr);
      }
    }

    this.setInstalledHash(meta.sha256, meta.version);
    notify('ready', 100, 'Installation complete!');
    return binaryPath;
  }

  private async extractDeb(debBuffer: Buffer): Promise<void> {
    // 1. Locate data.tar.* within ar archive (supports data.tar.xz, data.tar.gz, data.tar.zst)
    const dataTar = this.extractMemberFromAr(debBuffer, 'data.tar');
    if (!dataTar) {
      throw new Error('data.tar member not found in .deb archive');
    }

    // 2. Unpack data.tar using system tar into clientDir
    const tempTarPath = path.join(this.baseDir, 'temp_data.tar.xz');
    fs.writeFileSync(tempTarPath, dataTar);

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

  private extractMemberFromAr(buffer: Buffer, targetPrefix: string): Buffer | null {
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
      if (name.startsWith(targetPrefix)) {
        return buffer.subarray(offset, offset + size);
      }

      // ar offsets are 2-byte aligned
      offset += size + (size % 2);
    }
    return null;
  }
}

export const installer = new Rs3Installer();
