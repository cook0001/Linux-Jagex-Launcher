import test from 'node:test';
import assert from 'node:assert';
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
    assert.strictEqual(updater.getFormatDisplayLabel('aur'), 'Arch Linux (AUR)');
    assert.strictEqual(updater.getFormatDisplayLabel('tar'), 'Standalone Tarball');
    assert.strictEqual(updater.getFormatDisplayLabel('dev'), 'Development Environment');
  });

  await t.test('AutoUpdater detects package format and current version in testing environment', () => {
    const format = updater.getPackageFormat();
    assert.ok(['appimage', 'flatpak', 'snap', 'deb', 'aur', 'tar', 'dev'].includes(format));

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

    const snapRes = await updater.installUpdate('/tmp/non-existent-jagex-package.snap', 'snap');
    assert.strictEqual(snapRes.success, false);
    assert.ok(snapRes.error && snapRes.error.includes('found'));
  });

  await t.test('AutoUpdater downloadUpdate validates release assets properly', async () => {
    const mockRelease: any = {
      version: '1.4.4',
      tagName: 'v1.4.4',
      releaseNotes: 'Mock notes',
      publishedAt: new Date().toISOString(),
      htmlUrl: 'https://github.com/cook0001/Linux-Jagex-Launcher/releases',
      assets: {}
    };

    // Attempting to download when no asset exists should fail gracefully
    const dl = await updater.downloadUpdate(mockRelease, 'deb');
    assert.strictEqual(dl.success, false);
    assert.ok(dl.error && dl.error.includes('not found'));

    const snapDl = await updater.downloadUpdate(mockRelease, 'snap');
    assert.strictEqual(snapDl.success, false);
    assert.ok(snapDl.error && snapDl.error.includes('not found'));
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
