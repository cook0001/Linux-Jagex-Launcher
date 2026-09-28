import test from 'node:test';
import assert from 'node:assert';
import { store } from '../src/main/store.ts';

test('StoreManager configuration and settings', async (t) => {
  await t.test('provides valid default app settings', () => {
    const settings = store.getSettings();
    assert.strictEqual(typeof settings, 'object');
    assert.ok(['rs3', 'osrs', 'dragonwilds'].includes(settings.selectedGame));
    assert.strictEqual(settings.selectedOsrsClient, 'runelite');
    assert.strictEqual(typeof settings.closeOnLaunch, 'boolean');
    assert.strictEqual(typeof settings.useGameMode, 'boolean');
  });

  await t.test('sessions store maintains data integrity', () => {
    const sessions = store.getSessions();
    assert.strictEqual(typeof sessions, 'object');
    assert.strictEqual(typeof sessions.accounts, 'object');
    if (sessions.activeSub) {
      assert.strictEqual(typeof sessions.activeSub, 'string');
      const activeAccount = store.getActiveAccount();
      assert.notStrictEqual(activeAccount, null);
      assert.strictEqual(activeAccount?.sub, sessions.activeSub);
    }
  });
});
