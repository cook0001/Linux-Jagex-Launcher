import test from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { osrsDoctor } from '../src/main/osrs-diagnostics.ts';
import { osrs, classifyOsrsCrash } from '../src/main/osrs.ts';

test('Old School RuneScape Compatibility & Diagnostics Suite', async (t) => {
  await t.test('OsrsDoctor runs pre-flight checks and returns valid report', () => {
    const report = osrsDoctor.runDoctor();
    assert.strictEqual(typeof report.timestamp, 'number');
    assert.strictEqual(typeof report.osName, 'string');
    assert.strictEqual(typeof report.distroFamily, 'string');
    assert.strictEqual(typeof report.arch, 'string');
    assert.strictEqual(typeof report.isRoot, 'boolean');
    assert.ok(['runelite', 'hdos', 'official'].includes(report.selectedClient));
    assert.strictEqual(typeof report.allOk, 'boolean');
    assert.ok(Array.isArray(report.checks));
    assert.ok(report.checks.length >= 10, `Expected at least 10 checks, got ${report.checks.length}`);

    const checkIds = report.checks.map((c) => c.id);
    assert.ok(checkIds.includes('user_root'), 'Should contain root check');
    assert.ok(checkIds.includes('osrs_java_installed'), 'Should contain Java installed check');
    assert.ok(checkIds.includes('osrs_java_version'), 'Should contain Java version check');
    assert.ok(checkIds.includes('osrs_java_headless'), 'Should contain Headless Java check');
    assert.ok(checkIds.includes('osrs_client_status'), 'Should contain client status check');
    assert.ok(checkIds.includes('osrs_profile_perms'), 'Should contain profile permissions check');
    assert.ok(checkIds.includes('osrs_jvm_heap'), 'Should contain JVM heap check');
    assert.ok(checkIds.includes('osrs_opengl'), 'Should contain OpenGL check');
    assert.ok(checkIds.includes('osrs_recent_crash'), 'Should contain crash history check');
    assert.ok(checkIds.includes('osrs_jagex_auth'), 'Should contain session auth check');
    assert.ok(checkIds.includes('osrs_zombies'), 'Should contain zombie process check');
    assert.ok(checkIds.includes('osrs_display_scale'), 'Should contain display and font antialiasing check');
    assert.ok(checkIds.includes('osrs_audio'), 'Should contain ALSA audio check');

    const validCategories = ['system', 'java', 'client', 'storage', 'graphics', 'account', 'crash', 'audio', 'network'];
    for (const check of report.checks) {
      assert.ok(validCategories.includes(check.category), `Invalid category: ${check.category}`);
      assert.ok(['ok', 'warning', 'error'].includes(check.status), `Invalid status: ${check.status}`);
      assert.strictEqual(typeof check.message, 'string');
    }
  });

  await t.test('OsrsDoctor manages zombie processes safely', () => {
    const zombies = osrsDoctor.detectZombieProcesses();
    assert.ok(Array.isArray(zombies));

    // Calling killZombies should execute cleanly without error
    const killed = osrsDoctor.killZombies();
    assert.strictEqual(typeof killed, 'number');
    assert.ok(killed >= 0);
  });

  await t.test('OsrsDoctor runs asynchronous network probes and clock skew checks', async () => {
    const probedReport = await osrsDoctor.runDoctorWithProbes();
    assert.ok(Array.isArray(probedReport.checks));

    const checkIds = probedReport.checks.map((c) => c.id);
    assert.ok(checkIds.includes('net_osrs_config'), 'Should contain OSRS config probe');
    assert.ok(checkIds.includes('net_jagex_auth'), 'Should contain Jagex auth probe');
    assert.ok(checkIds.includes('osrs_network_clock'), 'Should contain NTP clock skew check');
  });

  await t.test('OsrsDoctor.parseJavaDetails identifies version, 64-bit, and headless status', () => {
    // 1. Standard Headful Java 17
    const outputHeadful = `openjdk version "17.0.9" 2023-10-17
OpenJDK Runtime Environment (build 17.0.9+9-Ubuntu-120.04)
OpenJDK 64-Bit Server VM (build 17.0.9+9-Ubuntu-120.04, mixed mode, sharing)`;
    const parsed17 = osrsDoctor.parseJavaDetails(null, outputHeadful);
    assert.strictEqual(parsed17.version, '17.0.9');
    assert.strictEqual(parsed17.majorVersion, 17);
    assert.strictEqual(parsed17.is64Bit, true);
    assert.strictEqual(parsed17.isHeadless, false);

    // 2. Legacy Java 8 32-bit
    const outputJava8 = `java version "1.8.0_381"
Java(TM) SE Runtime Environment (build 1.8.0_381-b09)
Java HotSpot(TM) Client VM (build 25.381-b09, mixed mode)`;
    const parsed8 = osrsDoctor.parseJavaDetails(null, outputJava8);
    assert.strictEqual(parsed8.version, '1.8.0_381');
    assert.strictEqual(parsed8.majorVersion, 8);
    assert.strictEqual(parsed8.is64Bit, false);

    // 3. Explicit Headless JRE string
    const outputHeadless = `openjdk version "21.0.2" 2024-01-16
OpenJDK Runtime Environment (build 21.0.2+13-Ubuntu-122.04.1)
OpenJDK 64-Bit Server VM (build 21.0.2+13-Ubuntu-122.04.1, mixed mode, sharing)
Java(TM) SE Runtime Environment (headless)`;
    const parsedHeadless = osrsDoctor.parseJavaDetails(null, outputHeadless);
    assert.strictEqual(parsedHeadless.majorVersion, 21);
    assert.strictEqual(parsedHeadless.is64Bit, true);
    assert.strictEqual(parsedHeadless.isHeadless, true);
  });

  await t.test('OsrsDoctor permission and directory validation handles safe paths', () => {
    const nonExistent = path.join(os.tmpdir(), `test-dir-nonexistent-${Date.now()}`);
    const isRootOwned = osrsDoctor.checkDirectoryRootOwnership(nonExistent);
    assert.strictEqual(isRootOwned, false);

    const repairRes = osrsDoctor.repairPermissions(nonExistent);
    assert.strictEqual(repairRes.repaired, true);

    // Existing test temp dir
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osrs-doctor-test-'));
    try {
      const owned = osrsDoctor.checkDirectoryRootOwnership(tempDir);
      assert.strictEqual(owned, false);
      const repairExisting = osrsDoctor.repairPermissions(tempDir);
      assert.strictEqual(repairExisting.repaired, true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('classifyOsrsCrash identifies all OSRS crash failure modes', () => {
    // 1. Headless JRE crash (missing AWT)
    const headlessOut = `
Exception in thread "main" java.awt.HeadlessException:
No X11 DISPLAY variable was set, but this program requires it.
	at java.desktop/java.awt.GraphicsEnvironment.checkHeadless(GraphicsEnvironment.java:166)
	at java.desktop/java.awt.Window.<init>(Window.java:540)
	at net.runelite.client.RuneLite.main(RuneLite.java:100)
    `;
    const c1 = classifyOsrsCrash(1, null, headlessOut, '');
    assert.strictEqual(c1.category, 'headless_jre');
    assert.strictEqual(c1.actionId, 'install_headful_java');
    assert.ok(c1.title.includes('Headless'));

    // 2. JVM Out of Memory
    const oomOut = `
[Client] INFO net.runelite.client.RuneLite - Starting plugins
Exception in thread "Client" java.lang.OutOfMemoryError: Java heap space
	at net.runelite.client.plugins.gpu.GpuPlugin.loadShaders(GpuPlugin.java:450)
    `;
    const c2 = classifyOsrsCrash(1, null, oomOut, '');
    assert.strictEqual(c2.category, 'jvm_oom');
    assert.strictEqual(c2.actionId, 'enable_lowspec');
    assert.ok(c2.title.includes('Heap'));

    // 3. Bad Java Version (UnsupportedClassVersionError)
    const classVerOut = `
Error: LinkageError occurred while loading main class net.runelite.client.RuneLite
	java.lang.UnsupportedClassVersionError: net/runelite/client/RuneLite has been compiled by a more recent version of the Java Runtime (class file version 61.0), this version of the Java Runtime only recognizes class file versions up to 55.0
    `;
    const c3 = classifyOsrsCrash(1, null, classVerOut, '');
    assert.strictEqual(c3.category, 'bad_java_version');

    // 4. Unsatisfied Link Error (missing native library)
    const linkErrOut = `
java.lang.UnsatisfiedLinkError: /home/user/.runelite/natives/libjogl_desktop.so: libGL.so.1: cannot open shared object file: No such file or directory
	at java.base/java.lang.ClassLoader$NativeLibrary.load0(Native Method)
    `;
    const c4 = classifyOsrsCrash(1, null, linkErrOut, '');
    assert.strictEqual(c4.category, 'unsatisfied_link');

    // 5. Permission Denied on client data
    const permErrOut = `
java.io.FileNotFoundException: /home/user/.runelite/settings.properties (Permission denied)
	at java.base/java.io.FileOutputStream.open0(Native Method)
    `;
    const c5 = classifyOsrsCrash(1, null, permErrOut, '');
    assert.strictEqual(c5.category, 'permission_denied');
    assert.strictEqual(c5.actionId, 'fix_runelite_perms');

    // 6. Fatal JVM Signal (SIGSEGV / hs_err_pid)
    const fatalOut = `
#
# A fatal error has been detected by the Java Runtime Environment:
#
#  SIGSEGV (0xb) at pc=0x00007f9c80a2b102, pid=12345, tid=12350
#
# JRE version: OpenJDK Runtime Environment (17.0.8+7)
# Problematic frame:
# C  [libm.so.6+0x2b102]
#
    `;
    const c6 = classifyOsrsCrash(null, 'SIGSEGV', fatalOut, '');
    assert.strictEqual(c6.category, 'jvm_fatal');
    assert.ok(c6.title.includes('Fatal Signal'));

    // 7. Generic unexpected failure
    const generic = classifyOsrsCrash(127, null, 'command not found', '');
    assert.strictEqual(generic.category, 'unknown');
  });

  await t.test('Markdown report generator outputs clean summary without sensitive data', () => {
    const report = osrsDoctor.runDoctor();
    const md = osrsDoctor.generateMarkdownReport(report);

    assert.ok(md.includes('OSRS Doctor Diagnostic Report'));
    assert.ok(md.includes('Diagnostic Checks:'));
    assert.ok(md.includes(report.selectedClient.toUpperCase()));
    assert.ok(!md.includes('Bearer '));
    assert.ok(!md.includes('password'));
  });

  await t.test('OSRS crash persistence and clearLastCrash lifecycle', () => {
    osrs.clearLastCrash();
    assert.strictEqual(osrs.getLastCrash(), null);
  });
});
