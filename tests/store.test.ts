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
    assert.strictEqual(settings.rs3MesaGlThread, true);
  });

  await t.test('sessions store maintains data integrity and multi-account switching', () => {
    const originalSessions = store.getSessions();
    assert.strictEqual(typeof originalSessions, 'object');
    assert.strictEqual(typeof originalSessions.accounts, 'object');

    // Simulate multi-account sessions
    const mockSessions = {
      accounts: {
        'sub-account-1': {
          sub: 'sub-account-1',
          displayName: 'PlayerOne',
          refreshToken: 'token-1',
          idToken: 'id-1',
          sessionId: 'session-1',
          characters: [{ id: 'char-1', displayName: 'PlayerOne' }]
        },
        'sub-account-2': {
          sub: 'sub-account-2',
          displayName: 'PlayerTwo',
          refreshToken: 'token-2',
          idToken: 'id-2',
          sessionId: 'session-2',
          characters: [{ id: 'char-2', displayName: 'PlayerTwo' }]
        }
      },
      activeSub: 'sub-account-1'
    };

    store.saveSessions(mockSessions);
    assert.strictEqual(store.getActiveAccount()?.displayName, 'PlayerOne');

    // Switch to account 2
    const switched = store.setActiveAccount('sub-account-2');
    assert.strictEqual(switched?.displayName, 'PlayerTwo');
    assert.strictEqual(store.getSessions().activeSub, 'sub-account-2');
    assert.strictEqual(store.getSettings().activeAccountId, 'sub-account-2');

    // Remove account 2 - should fall back to account 1
    const remaining = store.removeAccount('sub-account-2');
    assert.strictEqual(Object.keys(remaining.accounts).length, 1);
    assert.strictEqual(remaining.activeSub, 'sub-account-1');

    // Restore original sessions
    store.saveSessions(originalSessions);
  });
});
