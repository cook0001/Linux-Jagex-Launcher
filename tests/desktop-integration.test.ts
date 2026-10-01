import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { desktopIntegration } from '../src/main/desktop.ts';

test('Desktop Integration & Linux Dock Icon Suite', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jagex-desktop-test-'));
  const appsDir = path.join(tmpDir, 'applications');
  const iconsBaseDir = path.join(tmpDir, 'icons', 'hicolor');

  desktopIntegration.setDirectories(appsDir, iconsBaseDir);

  t.after(() => {
    desktopIntegration.resetDirectories();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  await t.test('DesktopIntegrationManager ensures directories', () => {
    desktopIntegration.ensureDirectories();
    assert.ok(fs.existsSync(appsDir), 'Applications directory must exist');
    assert.ok(fs.existsSync(iconsBaseDir), 'Icons base directory must exist');

    const expectedSizes = ['16x16', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512'];
    for (const size of expectedSizes) {
      assert.ok(fs.existsSync(path.join(iconsBaseDir, size, 'apps')), `${size}/apps directory must exist`);
    }
  });

  await t.test('Launcher desktop entry and icons are properly created', () => {
    desktopIntegration.installLauncherIntegration();

    const launcherDesktop = path.join(appsDir, 'linux-jagex-launcher.desktop');
    assert.ok(fs.existsSync(launcherDesktop), 'linux-jagex-launcher.desktop must exist');

    const content = fs.readFileSync(launcherDesktop, 'utf8');
    assert.ok(content.includes('[Desktop Entry]'));
    assert.ok(content.includes('StartupWMClass=linux-jagex-launcher'));
    assert.ok(content.includes('Icon=linux-jagex-launcher'));
    assert.ok(content.includes('MimeType=x-scheme-handler/jagex;x-scheme-handler/jagex-launcher;'));

    // Check at least one icon was copied
    const icon128 = path.join(iconsBaseDir, '128x128', 'apps', 'linux-jagex-launcher.png');
    const iconMaster = path.join(iconsBaseDir, '512x512', 'apps', 'linux-jagex-launcher.png');
    assert.ok(fs.existsSync(icon128) || fs.existsSync(iconMaster), 'Launcher icon must be installed in hicolor icons');
  });

  await t.test('RuneLite desktop entry and icon integration exists', () => {
    desktopIntegration.installRuneliteIntegration();

    const rlDesktop1 = path.join(appsDir, 'net.runelite.RuneLite.desktop');
    const rlDesktop2 = path.join(appsDir, 'runelite.desktop');
    const rlDesktop3 = path.join(appsDir, 'net-runelite-client-RuneLite.desktop');

    assert.ok(fs.existsSync(rlDesktop1), 'net.runelite.RuneLite.desktop must exist');
    assert.ok(fs.existsSync(rlDesktop2), 'runelite.desktop must exist');
    assert.ok(fs.existsSync(rlDesktop3), 'net-runelite-client-RuneLite.desktop must exist');

    const content1 = fs.readFileSync(rlDesktop1, 'utf8');
    assert.ok(content1.includes('StartupWMClass=net-runelite-client-RuneLite'));
    assert.ok(content1.includes('Icon=runelite'));
    assert.ok(content1.includes('NoDisplay=true'), 'net.runelite.RuneLite.desktop alias must have NoDisplay=true');

    const content2 = fs.readFileSync(rlDesktop2, 'utf8');
    assert.ok(content2.includes('StartupWMClass=net.runelite.client.RuneLite'));
    assert.ok(content2.includes('Icon=runelite'));
    assert.ok(!content2.includes('NoDisplay=true'), 'runelite.desktop primary entry must be visible in menu');

    const content3 = fs.readFileSync(rlDesktop3, 'utf8');
    assert.ok(content3.includes('NoDisplay=true'), 'net-runelite-client-RuneLite.desktop alias must have NoDisplay=true');
  });

  await t.test('RuneScape 3 desktop entry and icon integration exists', () => {
    desktopIntegration.installRs3Integration();

    const rs3Desktop1 = path.join(appsDir, 'runescape.desktop');
    const rs3Desktop2 = path.join(appsDir, 'runescape-launcher.desktop');
    const rs3Desktop3 = path.join(appsDir, 'rs2client.desktop');

    assert.ok(fs.existsSync(rs3Desktop1), 'runescape.desktop must exist');
    assert.ok(fs.existsSync(rs3Desktop2), 'runescape-launcher.desktop must exist');
    assert.ok(fs.existsSync(rs3Desktop3), 'rs2client.desktop must exist');

    const content1 = fs.readFileSync(rs3Desktop1, 'utf8');
    assert.ok(content1.includes('StartupWMClass=runescape'));
    assert.ok(content1.includes('Icon=runescape'));
    assert.ok(!content1.includes('NoDisplay=true'), 'runescape.desktop primary entry must be visible in menu');

    const content2 = fs.readFileSync(rs3Desktop2, 'utf8');
    assert.ok(content2.includes('NoDisplay=true'), 'runescape-launcher.desktop alias must have NoDisplay=true');

    const content3 = fs.readFileSync(rs3Desktop3, 'utf8');
    assert.ok(content3.includes('StartupWMClass=rs2client'));
    assert.ok(content3.includes('Icon=runescape'));
    assert.ok(content3.includes('NoDisplay=true'), 'rs2client.desktop alias must have NoDisplay=true');
  });

  await t.test('HDOS desktop entry integration exists', () => {
    desktopIntegration.installHdosIntegration();

    const hdosDesktop = path.join(appsDir, 'hdos.desktop');
    const hdosDesktop2 = path.join(appsDir, 'com-hdos-client-Client.desktop');
    assert.ok(fs.existsSync(hdosDesktop), 'hdos.desktop must exist');
    assert.ok(fs.existsSync(hdosDesktop2), 'com-hdos-client-Client.desktop must exist');

    const content = fs.readFileSync(hdosDesktop, 'utf8');
    assert.ok(content.includes('StartupWMClass=hdos'));
    assert.ok(content.includes('Icon=hdos'));
    assert.ok(!content.includes('NoDisplay=true'), 'hdos.desktop primary entry must be visible in menu');

    const content2 = fs.readFileSync(hdosDesktop2, 'utf8');
    assert.ok(content2.includes('NoDisplay=true'), 'com-hdos-client-Client.desktop alias must have NoDisplay=true');
  });

  await t.test('Official OSRS desktop entry and icon integration exists', () => {
    desktopIntegration.installOfficialOsrsIntegration();

    const osrsDesktop1 = path.join(appsDir, 'osrs.desktop');
    const osrsDesktop2 = path.join(appsDir, 'jagexapp-osrs.desktop');
    assert.ok(fs.existsSync(osrsDesktop1), 'osrs.desktop must exist');
    assert.ok(fs.existsSync(osrsDesktop2), 'jagexapp-osrs.desktop must exist');

    const content1 = fs.readFileSync(osrsDesktop1, 'utf8');
    assert.ok(content1.includes('StartupWMClass=osrs'));
    assert.ok(content1.includes('Icon=osrs'));
    assert.ok(!content1.includes('NoDisplay=true'), 'osrs.desktop primary entry must be visible in menu');

    const content2 = fs.readFileSync(osrsDesktop2, 'utf8');
    assert.ok(content2.includes('StartupWMClass=jagexapp.osrs'));
    assert.ok(content2.includes('Icon=osrs'));
    assert.ok(content2.includes('NoDisplay=true'), 'jagexapp-osrs.desktop alias must have NoDisplay=true');
  });

  await t.test('desktopIntegration.ensureAll executes cleanly', () => {
    desktopIntegration.ensureAll();
    assert.ok(fs.existsSync(path.join(appsDir, 'linux-jagex-launcher.desktop')));
    assert.ok(fs.existsSync(path.join(appsDir, 'runescape.desktop')));
    assert.ok(fs.existsSync(path.join(appsDir, 'runelite.desktop')));
    assert.ok(fs.existsSync(path.join(appsDir, 'hdos.desktop')));
    assert.ok(fs.existsSync(path.join(appsDir, 'osrs.desktop')));
  });
});

