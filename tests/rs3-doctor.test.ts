import test from 'node:test';
import assert from 'node:assert';
import { store } from '../src/main/store.ts';
import { installer } from '../src/main/installer.ts';
import { doctor } from '../src/main/diagnostics.ts';

test('RuneScape 3 Compatibility & Diagnostics Suite', async (t) => {
  await t.test('StoreManager includes RS3 graphics, Wayland, and audio settings', () => {
    const settings = store.getSettings();
    assert.strictEqual(typeof settings.rs3ForceX11, 'boolean');
    assert.strictEqual(typeof settings.rs3AudioLatencyFix, 'boolean');
    assert.ok(['none', 'zink', 'prime'].includes(settings.rs3GpuWorkaround));
    assert.ok(settings.configUri.includes('jav_config.ws'));
  });

  await t.test('Installer exposes isolated compat library paths', () => {
    const compatDir = installer.getCompatLibDir();
    assert.strictEqual(typeof compatDir, 'string');
    assert.ok(compatDir.includes('compat'));
    assert.ok(compatDir.includes('lib64'));

    const isAvailable = installer.isLibSslAvailable();
    assert.strictEqual(typeof isAvailable, 'boolean');
  });

  await t.test('Installer clearClientCache returns cleared and errors lists', () => {
    const res = installer.clearClientCache();
    assert.ok(Array.isArray(res.cleared));
    assert.ok(Array.isArray(res.errors));
  });

  await t.test('Rs3Doctor runs and inspects critical Ubuntu and Wayland requirements', () => {
    const report = doctor.runDoctor();
    assert.strictEqual(typeof report.timestamp, 'number');
    assert.strictEqual(typeof report.osName, 'string');
    assert.strictEqual(typeof report.arch, 'string');
    assert.strictEqual(typeof report.isRoot, 'boolean');
    assert.strictEqual(typeof report.displayServer, 'string');
    assert.ok(Array.isArray(report.checks));
    assert.ok(report.checks.length >= 6);

    const checkIds = report.checks.map(c => c.id);
    assert.ok(checkIds.includes('user_root'), 'Should contain user_root permission check');
    assert.ok(checkIds.includes('libssl11'), 'Should contain libssl1.1 compatibility check');
    assert.ok(checkIds.includes('opengl'), 'Should contain OpenGL driver check');
    assert.ok(checkIds.includes('vulkan'), 'Should contain Vulkan driver check');
    assert.ok(checkIds.includes('wayland'), 'Should contain Wayland compatibility check');
    assert.ok(checkIds.includes('jagex_auth'), 'Should contain Jagex Account session check');

    // Verify each check has required fields
    for (const check of report.checks) {
      assert.ok(['ok', 'warning', 'error'].includes(check.status));
      assert.strictEqual(typeof check.name, 'string');
      assert.strictEqual(typeof check.message, 'string');
    }
  });

  await t.test('StoreManager persists custom RS3 compatibility overrides', () => {
    const original = store.getSettings();
    store.saveSettings({
      rs3GpuWorkaround: 'zink',
      rs3ForceX11: true,
      rs3AudioLatencyFix: true
    });

    const updated = store.getSettings();
    assert.strictEqual(updated.rs3GpuWorkaround, 'zink');
    assert.strictEqual(updated.rs3ForceX11, true);
    assert.strictEqual(updated.rs3AudioLatencyFix, true);

    // Restore
    store.saveSettings({
      rs3GpuWorkaround: original.rs3GpuWorkaround,
      rs3ForceX11: original.rs3ForceX11,
      rs3AudioLatencyFix: original.rs3AudioLatencyFix
    });
  });
});
