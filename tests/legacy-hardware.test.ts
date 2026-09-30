import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { store, DEFAULT_SETTINGS } from '../src/main/store.ts';
import { doctor } from '../src/main/diagnostics.ts';

test('Older Linux Hardware & Low-Spec Performance Mode Suite', async (t) => {
  await t.test('StoreManager provides expected older hardware settings and defaults', () => {
    const settings = store.getSettings();
    assert.strictEqual(typeof settings.lowSpecMode, 'boolean');
    assert.strictEqual(typeof settings.rs3CompatProfileOverride, 'boolean');
    assert.strictEqual(typeof settings.rs3DisableDri3, 'boolean');

    // Canonical default values contract
    assert.strictEqual(DEFAULT_SETTINGS.lowSpecMode, false);
    assert.strictEqual(DEFAULT_SETTINGS.rs3CompatProfileOverride, true);
    assert.strictEqual(DEFAULT_SETTINGS.rs3DisableDri3, false);
    assert.strictEqual(DEFAULT_SETTINGS.rs3MesaGlThread, true);
  });

  await t.test('StoreManager successfully toggles and persists Low-Spec Mode', () => {
    const original = store.getSettings();
    store.saveSettings({
      lowSpecMode: true,
      rs3CompatProfileOverride: true,
      rs3DisableDri3: true
    });

    const updated = store.getSettings();
    assert.strictEqual(updated.lowSpecMode, true);
    assert.strictEqual(updated.rs3CompatProfileOverride, true);
    assert.strictEqual(updated.rs3DisableDri3, true);

    // Revert to original
    store.saveSettings({
      lowSpecMode: original.lowSpecMode,
      rs3CompatProfileOverride: original.rs3CompatProfileOverride,
      rs3DisableDri3: original.rs3DisableDri3
    });
  });

  await t.test('Rs3Doctor includes hardware memory and CPU diagnostics', () => {
    const report = doctor.runDoctor();
    const memCheck = report.checks.find(c => c.id === 'sys_memory');
    assert.ok(memCheck, 'Expected sys_memory check in doctor report');
    assert.ok(['ok', 'warning'].includes(memCheck.status));
    assert.ok(memCheck.message.includes('GB of RAM'));

    const cpuCheck = report.checks.find(c => c.id === 'cpu_hardware');
    assert.ok(cpuCheck, 'Expected cpu_hardware check in doctor report');
    assert.ok(['ok', 'warning'].includes(cpuCheck.status));

    const mesaCheck = report.checks.find(c => c.id === 'mesa_compat');
    assert.ok(mesaCheck, 'Expected mesa_compat check in doctor report');
    assert.strictEqual(mesaCheck.status, 'ok');
    assert.ok(mesaCheck.message.includes('MESA_GL_VERSION_OVERRIDE=4.5COMPAT'));
  });

  await t.test('Settings modal tab buttons and tab contents are arranged in order: General, RS3, OSRS', () => {
    const htmlPath = path.resolve(process.cwd(), 'src/renderer/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Tab buttons order: General -> RS3 -> OSRS
    const generalBtnIdx = html.indexOf('id="tab-btn-general"');
    const rs3BtnIdx = html.indexOf('id="tab-btn-rs3"');
    const osrsBtnIdx = html.indexOf('id="tab-btn-osrs"');

    assert.ok(generalBtnIdx !== -1, 'tab-btn-general must exist');
    assert.ok(rs3BtnIdx !== -1, 'tab-btn-rs3 must exist');
    assert.ok(osrsBtnIdx !== -1, 'tab-btn-osrs must exist');
    assert.ok(generalBtnIdx < rs3BtnIdx, 'tab-btn-general must precede tab-btn-rs3');
    assert.ok(rs3BtnIdx < osrsBtnIdx, 'tab-btn-rs3 must precede tab-btn-osrs');

    // Tab contents order: General -> RS3 -> OSRS
    const generalContentIdx = html.indexOf('id="tab-general"');
    const rs3ContentIdx = html.indexOf('id="tab-rs3"');
    const osrsContentIdx = html.indexOf('id="tab-osrs"');

    assert.ok(generalContentIdx !== -1, 'tab-general must exist');
    assert.ok(rs3ContentIdx !== -1, 'tab-rs3 must exist');
    assert.ok(osrsContentIdx !== -1, 'tab-osrs must exist');
    assert.ok(generalContentIdx < rs3ContentIdx, 'tab-general must precede tab-rs3');
    assert.ok(rs3ContentIdx < osrsContentIdx, 'tab-rs3 must precede tab-osrs');
  });

  await t.test('app.ts wires sidebar settings to tab-general and quick settings to active game tab', () => {
    const appPath = path.resolve(process.cwd(), 'src/renderer/scripts/app.ts');
    const appCode = fs.readFileSync(appPath, 'utf8');

    assert.ok(appCode.includes("openSettings('tab-general')"), 'Sidebar settings must open General tab');
    assert.ok(appCode.includes("openSettings('tab-rs3')"), 'Quick settings on RS3 must open RS3 tab');
    assert.ok(appCode.includes("openSettings('tab-osrs')"), 'Quick settings on OSRS must open OSRS tab');
  });

  await t.test('UI styles disable heavy backdrop-filter blurs and continuous animations for general use', () => {
    const layoutPath = path.resolve(process.cwd(), 'src/renderer/styles/layout.css');
    const layoutCss = fs.readFileSync(layoutPath, 'utf8');
    assert.ok(!layoutCss.includes('backdrop-filter: blur(12px)'), 'layout.css must not use heavy 12px blurs');
    assert.ok(!layoutCss.includes('backdrop-filter: blur(20px)'), 'layout.css must not use heavy 20px blurs');

    const animPath = path.resolve(process.cwd(), 'src/renderer/styles/animations.css');
    const animCss = fs.readFileSync(animPath, 'utf8');
    assert.ok(!animCss.includes('animation: play-shimmer 4s infinite'), 'Play button shimmer must not run continuously');

    const osrsPath = path.resolve(process.cwd(), 'src/main/osrs.ts');
    const osrsCode = fs.readFileSync(osrsPath, 'utf8');
    assert.ok(osrsCode.includes("'-Xmx768m'"), 'OSRS manager must limit heap to 768MB in lowSpecMode');
    assert.ok(osrsCode.includes("'-Dsun.java2d.opengl=true'"), 'OSRS manager must force OpenGL acceleration in lowSpecMode');
  });
});

