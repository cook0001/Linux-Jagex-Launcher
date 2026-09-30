import test from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import { store } from '../src/main/store.ts';
import { installer } from '../src/main/installer.ts';
import { doctor, DISTRO_PACKAGES, detectDistroFamily } from '../src/main/diagnostics.ts';
import { classifyCrash, sanitizeReportText, launcher } from '../src/main/launcher.ts';

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
    assert.strictEqual(typeof report.distroFamily, 'string');
    assert.strictEqual(typeof report.arch, 'string');
    assert.strictEqual(typeof report.isRoot, 'boolean');
    assert.strictEqual(typeof report.displayServer, 'string');
    assert.ok(Array.isArray(report.checks));
    assert.ok(report.checks.length >= 10);

    const checkIds = report.checks.map(c => c.id);
    assert.ok(checkIds.includes('user_root'), 'Should contain user_root permission check');
    assert.ok(checkIds.includes('libssl11'), 'Should contain libssl1.1 compatibility check');
    assert.ok(checkIds.includes('opengl'), 'Should contain OpenGL driver check');
    assert.ok(checkIds.includes('vulkan'), 'Should contain Vulkan driver check');
    assert.ok(checkIds.includes('wayland'), 'Should contain Wayland compatibility check');
    assert.ok(checkIds.includes('jagex_auth'), 'Should contain Jagex Account session check');
    assert.ok(checkIds.includes('sys_memory'), 'Should contain system RAM capacity check');
    assert.ok(checkIds.includes('cpu_hardware'), 'Should contain CPU core availability check');
    assert.ok(checkIds.includes('mesa_compat'), 'Should contain Mesa compatibility profile check');
    assert.ok(checkIds.includes('recent_crash'), 'Should contain recent_crash stability check');
    assert.ok(checkIds.includes('audio_runtime'), 'Should contain audio_runtime driver check');

    // Verify each check has required fields and valid categories
    const validCategories = ['system', 'dependency', 'graphics', 'audio', 'storage', 'network', 'tools', 'account', 'crash'];
    for (const check of report.checks) {
      assert.ok(['ok', 'warning', 'error'].includes(check.status));
      assert.strictEqual(typeof check.name, 'string');
      assert.strictEqual(typeof check.message, 'string');
      assert.ok(validCategories.includes(check.category), `Category ${check.category} should be valid`);
    }
  });

  await t.test('Crash Classifier correctly detects failure signatures', () => {
    // 1. Missing Library
    const missingSsl = classifyCrash(127, null, 'runescape: error while loading shared libraries: libssl.so.1.1: cannot open shared object file', '');
    assert.strictEqual(missingSsl.category, 'missing_lib');
    assert.strictEqual(missingSsl.actionId, 'install_ssl');

    // 2. Kernel OOM Kill
    const oomCrash = classifyCrash(137, 'SIGKILL', '', '');
    assert.strictEqual(oomCrash.category, 'oom_kill');
    assert.strictEqual(oomCrash.actionId, 'enable_lowspec');

    // 3. Vulkan / GPU Driver Segfault
    const vulkanSegfault = classifyCrash(139, 'SIGSEGV', 'radeonsi_dri.so: segmentation fault in amdgpu_cs_submit', '');
    assert.strictEqual(vulkanSegfault.category, 'vulkan_gpu');
    assert.strictEqual(vulkanSegfault.actionId, 'enable_zink');

    // 4. Wayland / X11 Disconnect
    const waylandFail = classifyCrash(1, null, 'GDK_BACKEND error: X connection to :0 broken (explicit kill or server shutdown)', '');
    assert.strictEqual(waylandFail.category, 'display_wayland');
    assert.strictEqual(waylandFail.actionId, 'enable_x11');

    // 5. Audio Buffer Stall
    const audioCrash = classifyCrash(1, null, 'ALSA lib pcm.c: snd_pcm_avail update failed: Broken pipe', '');
    assert.strictEqual(audioCrash.category, 'audio_stall');
    assert.strictEqual(audioCrash.actionId, 'enable_audio_fix');

    // 6. Cache Corruption
    const cacheCrash = classifyCrash(1, null, 'Archive checksum error loading cache block index', '');
    assert.strictEqual(cacheCrash.category, 'cache_corrupt');
    assert.strictEqual(cacheCrash.actionId, 'clear_cache');
  });

  await t.test('Sanitizer removes home directory paths and redacts authentication secrets', () => {
    const raw = `Crash in ${os.homedir()}/.local/share/game with JX_SESSION_ID=secret12345&JX_CHARACTER_ID=char999 and token="bearer_abc"`;
    const sanitized = sanitizeReportText(raw);
    assert.ok(!sanitized.includes(os.homedir()), 'Should not contain raw homedir');
    assert.ok(sanitized.includes('~/.local/share/game'), 'Should replace homedir with ~');
    assert.ok(!sanitized.includes('secret12345'), 'Should redact JX_SESSION_ID');
    assert.ok(!sanitized.includes('char999'), 'Should redact JX_CHARACTER_ID');
    assert.ok(!sanitized.includes('bearer_abc'), 'Should redact token string');
  });

  await t.test('Multi-Distro Package Dictionary supports Debian, Arch, Fedora, and openSUSE', () => {
    assert.ok(DISTRO_PACKAGES.debian.commandPrefix.includes('apt'));
    assert.ok(DISTRO_PACKAGES.arch.commandPrefix.includes('pacman'));
    assert.ok(DISTRO_PACKAGES.fedora.commandPrefix.includes('dnf'));
    assert.ok(DISTRO_PACKAGES.opensuse.commandPrefix.includes('zypper'));

    const detected = detectDistroFamily();
    assert.ok(['debian', 'arch', 'fedora', 'opensuse', 'generic'].includes(detected));
  });

  await t.test('Markdown report generator outputs clean diagnostic summary', () => {
    const report = doctor.runDoctor();
    const md = doctor.generateMarkdownReport(report);
    assert.ok(md.includes('### Linux Jagex Launcher - RS3 Doctor Diagnostic Report'));
    assert.ok(md.includes(report.osName));
    assert.ok(md.includes('Diagnostic Checks:'));
    assert.ok(md.includes('user_root'));
  });

  await t.test('Launcher manages crash records and safe mode settings', () => {
    launcher.clearLastCrash();
    assert.strictEqual(launcher.getLastCrash(), null);
  });

  await t.test('StoreManager persists custom RS3 compatibility overrides', () => {
    const original = store.getSettings();
    store.saveSettings({
      rs3GpuWorkaround: 'zink',
      rs3ForceX11: true,
      rs3AudioLatencyFix: true,
      rs3CompatProfileOverride: true,
      rs3DisableDri3: true
    });

    const updated = store.getSettings();
    assert.strictEqual(updated.rs3GpuWorkaround, 'zink');
    assert.strictEqual(updated.rs3ForceX11, true);
    assert.strictEqual(updated.rs3AudioLatencyFix, true);
    assert.strictEqual(updated.rs3CompatProfileOverride, true);
    assert.strictEqual(updated.rs3DisableDri3, true);

    // Restore
    store.saveSettings({
      rs3GpuWorkaround: original.rs3GpuWorkaround,
      rs3ForceX11: original.rs3ForceX11,
      rs3AudioLatencyFix: original.rs3AudioLatencyFix,
      rs3CompatProfileOverride: original.rs3CompatProfileOverride,
      rs3DisableDri3: original.rs3DisableDri3
    });
  });
});

