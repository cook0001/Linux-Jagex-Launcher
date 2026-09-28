import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

function getFileHashes(filePath) {
  const content = fs.readFileSync(filePath);
  const size = content.length;
  const md5 = crypto.createHash('md5').update(content).digest('hex');
  const sha1 = crypto.createHash('sha1').update(content).digest('hex');
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  return { size, md5, sha1, sha256 };
}

export function buildAptRepo(rootDir = process.cwd()) {
  const docsAptDir = path.join(rootDir, 'docs', 'apt');
  const poolDir = path.join(docsAptDir, 'pool', 'main', 'j', 'jagex-launcher');
  const distDir = path.join(docsAptDir, 'dists', 'stable', 'main', 'binary-amd64');

  fs.mkdirSync(poolDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  // Find all .deb files in poolDir or /tmp/test-artifact/
  let debFiles = fs.readdirSync(poolDir).filter(f => f.endsWith('.deb'));

  if (debFiles.length === 0) {
    const artifactDeb = '/tmp/test-artifact/linux-jagex-launcher-packages/jagex-launcher_1.0.0_amd64.deb';
    if (fs.existsSync(artifactDeb)) {
      const dest = path.join(poolDir, 'jagex-launcher_1.0.0_amd64.deb');
      fs.copyFileSync(artifactDeb, dest);
      debFiles = ['jagex-launcher_1.0.0_amd64.deb'];
      console.log(`Copied initial deb package into: ${dest}`);
    }
  }

  if (debFiles.length === 0) {
    console.log('No deb files found in pool to index.');
    return;
  }

  let packagesContent = '';

  for (const deb of debFiles) {
    const debPath = path.join(poolDir, deb);
    const hashes = getFileHashes(debPath);
    const relPoolPath = path.relative(docsAptDir, debPath);

    packagesContent += [
      `Package: jagex-launcher`,
      `Version: 1.0.0`,
      `Architecture: amd64`,
      `Maintainer: Daniel Cook <danielcook2016@outlook.com>`,
      `Installed-Size: 289384`,
      `Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2-0, libdrm2, libgbm1, libasound2, tar, xz-utils`,
      `Recommends: default-jre, gamemode`,
      `Section: games`,
      `Priority: optional`,
      `Homepage: https://cook0001.github.io/Linux-Jagex-Launcher/`,
      `Description: Official Jagex Launcher for Linux`,
      ` Authentic, native Jagex Launcher for Linux supporting RuneScape 3 and Old School RuneScape (RuneLite, HDOS, and Official client) with direct OAuth 2.0 PKCE authentication.`,
      `Filename: ${relPoolPath}`,
      `Size: ${hashes.size}`,
      `MD5sum: ${hashes.md5}`,
      `SHA1: ${hashes.sha1}`,
      `SHA256: ${hashes.sha256}`,
      '',
      ''
    ].join('\n');
  }

  const packagesPath = path.join(distDir, 'Packages');
  fs.writeFileSync(packagesPath, packagesContent);

  const packagesGzPath = path.join(distDir, 'Packages.gz');
  fs.writeFileSync(packagesGzPath, zlib.gzipSync(Buffer.from(packagesContent)));

  // Generate Release file
  const pkgsHashes = getFileHashes(packagesPath);
  const pkgsGzHashes = getFileHashes(packagesGzPath);

  const relPkgs = path.relative(path.join(docsAptDir, 'dists', 'stable'), packagesPath);
  const relPkgsGz = path.relative(path.join(docsAptDir, 'dists', 'stable'), packagesGzPath);

  const releaseContent = [
    `Origin: Linux Jagex Launcher`,
    `Label: Linux Jagex Launcher`,
    `Suite: stable`,
    `Codename: stable`,
    `Version: 1.0.0`,
    `Architectures: amd64`,
    `Components: main`,
    `Description: Official APT repository for Linux Jagex Launcher`,
    `Date: ${new Date().toUTCString()}`,
    `MD5Sum:`,
    ` ${pkgsHashes.md5} ${pkgsHashes.size} ${relPkgs}`,
    ` ${pkgsGzHashes.md5} ${pkgsGzHashes.size} ${relPkgsGz}`,
    `SHA1:`,
    ` ${pkgsHashes.sha1} ${pkgsHashes.size} ${relPkgs}`,
    ` ${pkgsGzHashes.sha1} ${pkgsGzHashes.size} ${relPkgsGz}`,
    `SHA256:`,
    ` ${pkgsHashes.sha256} ${pkgsHashes.size} ${relPkgs}`,
    ` ${pkgsGzHashes.sha256} ${pkgsGzHashes.size} ${relPkgsGz}`,
    ''
  ].join('\n');

  const releasePath = path.join(docsAptDir, 'dists', 'stable', 'Release');
  fs.writeFileSync(releasePath, releaseContent);

  console.log('✅ Generated APT Repository:');
  console.log(` - ${packagesPath}`);
  console.log(` - ${packagesGzPath}`);
  console.log(` - ${releasePath}`);
}

buildAptRepo();
