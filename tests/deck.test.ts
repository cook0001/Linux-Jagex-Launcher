import test from 'node:test';
import assert from 'node:assert';
import { deck } from '../src/main/deck.ts';
import { steamShortcuts, computeSteamShortcutAppId } from '../src/main/steam-shortcuts.ts';

test('Steam Deck & SteamOS Handheld Suite', async (t) => {
  await t.test('SteamDeckManager provides valid deck and handheld information', () => {
    const info = deck.getDeckInfo();
    assert.strictEqual(typeof info.isSteamDeck, 'boolean');
    assert.strictEqual(typeof info.isSteamOS, 'boolean');
    assert.strictEqual(typeof info.isGameMode, 'boolean');
    assert.ok(['LCD', 'OLED', 'Generic Handheld', 'Desktop/Other'].includes(info.model));
    assert.ok(info.refreshRateTarget === 60 || info.refreshRateTarget === 90);
    assert.strictEqual(typeof info.productName, 'string');
  });

  await t.test('computeSteamShortcutAppId deterministically calculates Steam AppID with high bit set', () => {
    const appId1 = computeSteamShortcutAppId('/home/deck/Applications/Jagex-Launcher.AppImage', 'Jagex Launcher');
    const appId2 = computeSteamShortcutAppId('/home/deck/Applications/Jagex-Launcher.AppImage', 'Jagex Launcher');

    assert.strictEqual(typeof appId1, 'number');
    assert.strictEqual(appId1, appId2, 'AppID must be deterministic for identical path and name');
    assert.ok(appId1 > 0x80000000, 'Steam Non-Steam shortcut AppID must have high bit 0x80000000 set');
  });

  await t.test('SteamShortcutManager locates Steam user directories or gracefully returns empty array', () => {
    const dirs = steamShortcuts.getUserDataDirs();
    assert.ok(Array.isArray(dirs));

    const exe = steamShortcuts.getExecutablePath();
    assert.strictEqual(typeof exe, 'string');
    assert.ok(exe.length > 0);
  });
});
