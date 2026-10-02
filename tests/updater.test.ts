import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { compareSemver, updater } from '../src/main/updater.ts';
import { store } from '../src/main/store.ts';

test('Auto Updater & Semantic Version Suite', async (t) => {
  await t.test('compareSemver accurately compares semver strings', () => {
    // Greater than
    assert.strictEqual(compareSemver('1.1.0', '1.0.0'), 1);
    assert.strictEqual(compareSemver('2.0.0', '1.9.9'), 1);
    assert.strictEqual(compareSemver('1.0.1', '1.0.0'), 1);
    assert.strictEqual(compareSemver('v1.2.0', '1.1.9'), 1);
    assert.strictEqual(compareSemver('v1.10.0', 'v1.9.0'), 1);

    // Less than
    assert.strictEqual(compareSemver('1.0.0', '1.1.0'), -1);
    assert.strictEqual(compareSemver('0.9.0', '1.0.0'), -1);
    assert.strictEqual(compareSemver('v1.0.0', 'v1.0.1'), -1);

    // Equal
    assert.strictEqual(compareSemver('1.0.0', '1.0.0'), 0);
    assert.strictEqual(compareSemver('v1.0.0', '1.0.0'), 0);
    assert.strictEqual(compareSemver('1.0', '1.0.0'), 0);
  });

  await t.test('AutoUpdater provides format display labels for all packaging formats', () => {
    assert.strictEqual(updater.getFormatDisplayLabel('appimage'), 'AppImage (Direct In-App Updates)');
    assert.strictEqual(updater.getFormatDisplayLabel('flatpak'), 'Flatpak / Flathub');
    assert.strictEqual(updater.getFormatDisplayLabel('snap'), 'Snap (Managed by Snapd)');
    assert.strictEqual(updater.getFormatDisplayLabel('deb'), 'Debian / Ubuntu (.deb)');
    assert.strictEqual(updater.getFormatDisplayLabel('rpm'), 'Fedora / RHEL (.rpm)');
    assert.strictEqual(updater.getFormatDisplayLabel('pacman'), 'Arch Linux (.pacman)');
    assert.strictEqual(updater.getFormatDisplayLabel('aur'), 'Arch Linux (AUR)');
    assert.strictEqual(updater.getFormatDisplayLabel('tar'), 'Standalone Tarball');
    assert.strictEqual(updater.getFormatDisplayLabel('dev'), 'Development Environment');
  });

  await t.test('AutoUpdater detects package format and current version in testing environment', () => {
    const format = updater.getPackageFormat();
    assert.ok(['appimage', 'flatpak', 'snap', 'deb', 'rpm', 'pacman', 'aur', 'tar', 'dev'].includes(format));

    const version = updater.getCurrentVersion();
    assert.strictEqual(typeof version, 'string');
    assert.ok(version.length > 0);
  });

  await t.test('AutoUpdater detects Linux distro family correctly', () => {
    const family = updater.getSystemFamily();
    assert.ok(['debian', 'arch', 'fedora', 'unknown'].includes(family));
  });

  await t.test('AutoUpdater installUpdate safeguards against non-existent files', async () => {
    const res = await updater.installUpdate('/tmp/non-existent-jagex-package.deb', 'deb');
    assert.strictEqual(res.success, false);
    assert.ok(res.error && res.error.includes('found'));

    const rpmRes = await updater.installUpdate('/tmp/non-existent-jagex-package.rpm', 'rpm');
    assert.strictEqual(rpmRes.success, false);
    assert.ok(rpmRes.error && res.error.includes('found'));

    const pacmanRes = await updater.installUpdate('/tmp/non-existent-jagex-package.pacman', 'pacman');
    assert.strictEqual(pacmanRes.success, false);
    assert.ok(pacmanRes.error && res.error.includes('found'));

    const snapRes = await updater.installUpdate('/tmp/non-existent-jagex-package.snap', 'snap');
    assert.strictEqual(snapRes.success, false);
    assert.ok(snapRes.error && snapRes.error.includes('found'));

    const tarRes = await updater.installUpdate('/tmp/non-existent-jagex-package.tar.gz', 'tar');
    assert.strictEqual(tarRes.success, false);
    assert.ok(tarRes.error && tarRes.error.includes('found'));
  });

  await t.test('AutoUpdater downloadUpdate validates release assets properly across all formats', async () => {
    const mockRelease: any = {
      version: '1.4.4',
      tagName: 'v1.4.4',
      releaseNotes: 'Mock notes',
      publishedAt: new Date().toISOString(),
      htmlUrl: 'https://github.com/cook0001/Linux-Jagex-Launcher/releases',
      assets: {}
    };

    // Attempting to download when no asset exists should fail gracefully
    const dlDeb = await updater.downloadUpdate(mockRelease, 'deb');
    assert.strictEqual(dlDeb.success, false);
    assert.ok(dlDeb.error && dlDeb.error.includes('not found'));

    const dlRpm = await updater.downloadUpdate(mockRelease, 'rpm');
    assert.strictEqual(dlRpm.success, false);
    assert.ok(dlRpm.error && dlRpm.error.includes('not found'));

    const dlPacman = await updater.downloadUpdate(mockRelease, 'pacman');
    assert.strictEqual(dlPacman.success, false);
    assert.ok(dlPacman.error && dlPacman.error.includes('not found'));

    const dlAppImage = await updater.downloadUpdate(mockRelease, 'appimage');
    assert.strictEqual(dlAppImage.success, false);
    assert.ok(dlAppImage.error && dlAppImage.error.includes('not found'));

    const snapDl = await updater.downloadUpdate(mockRelease, 'snap');
    assert.strictEqual(snapDl.success, false);
    assert.ok(snapDl.error && snapDl.error.includes('not found'));
  });

  await t.test('AppImage atomic in-place update replaces executing binary safely', async () => {
    const tmpDir = path.join(os.tmpdir(), `updater-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const runningApp = path.join(tmpDir, 'Jagex-Launcher-1.4.3.AppImage');
    const newUpdate = path.join(tmpDir, 'Jagex-Launcher-1.4.4.AppImage');

    fs.writeFileSync(runningApp, 'VERSION_1_4_3_CONTENT');
    fs.writeFileSync(newUpdate, 'VERSION_1_4_4_CONTENT');

    const origEnv = process.env.APPIMAGE;
    process.env.APPIMAGE = runningApp;

    try {
      const installRes = await updater.installAppImage(newUpdate);
      assert.strictEqual(installRes.success, true);
      assert.strictEqual(installRes.requiresRestart, true);

      // Verify that runningApp was updated in place with new content
      const updatedContent = fs.readFileSync(runningApp, 'utf-8');
      assert.strictEqual(updatedContent, 'VERSION_1_4_4_CONTENT');

      // Verify permissions
      const stat = fs.statSync(runningApp);
      assert.ok((stat.mode & 0o111) !== 0, 'Binary should be executable');
    } finally {
      process.env.APPIMAGE = origEnv;
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });

  await t.test('StoreManager manages updater settings and state correctly', () => {
    const settings = store.getSettings();
    assert.strictEqual(typeof settings.autoCheckUpdates, 'boolean');
    assert.strictEqual(typeof settings.lastUpdateCheck, 'number');

    // Test saving updater settings
    const updated = store.saveSettings({
      autoCheckUpdates: true,
      skippedVersion: '9.9.9'
    });
    assert.strictEqual(updated.autoCheckUpdates, true);
    assert.strictEqual(updated.skippedVersion, '9.9.9');

    // Clean up
    store.saveSettings({ skippedVersion: null });
  });
});
