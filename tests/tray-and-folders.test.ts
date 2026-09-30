import test from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { quickFolders } from '../src/main/folders.ts';
import { trayManager } from '../src/main/tray.ts';

test('Native System Tray and Quick Folders Hub Suite', async (t) => {
  await t.test('QuickFoldersManager provides comprehensive list of client folders', () => {
    const folders = quickFolders.getFolders();
    assert.ok(Array.isArray(folders), 'Folders must be an array');
    assert.ok(folders.length >= 10, 'Must provide at least 10 quick folders');

    const expectedIds = [
      'rl-screenshots',
      'rs3-screenshots',
      'hdos-screenshots',
      'rl-cache',
      'rs3-cache',
      'hdos-cache',
      'rl-logs',
      'rs3-logs',
      'hdos-logs',
      'launcher-config',
    ];

    for (const id of expectedIds) {
      const match = folders.find((f) => f.id === id);
      assert.ok(match, `Folder with id ${id} must be registered`);
      assert.ok(match.name && match.name.length > 0, `Folder ${id} must have a name`);
      assert.ok(match.label && match.label.length > 0, `Folder ${id} must have a label`);
      assert.ok(match.primaryPath && match.primaryPath.length > 0, `Folder ${id} must have a primaryPath`);
      assert.ok(
        ['screenshots', 'cache', 'logs', 'config'].includes(match.category),
        `Folder ${id} must have valid category`
      );
      assert.ok(
        ['runelite', 'rs3', 'hdos', 'launcher'].includes(match.client),
        `Folder ${id} must have valid client`
      );
    }
  });

  await t.test('QuickFoldersManager resolves expected paths correctly', () => {
    const home = os.homedir();
    const rlScreenshots = quickFolders.resolvePath('rl-screenshots');
    assert.strictEqual(rlScreenshots, path.join(home, '.runelite', 'screenshots'));

    const hdosCache = quickFolders.resolvePath('hdos-cache');
    assert.strictEqual(hdosCache, path.join(home, '.hdos', 'cache'));

    const customPath = quickFolders.resolvePath('~/test-folder');
    assert.strictEqual(customPath, path.join(home, 'test-folder'));
  });

  await t.test('QuickFoldersManager safely creates directory if missing', async () => {
    const testDir = path.join(os.tmpdir(), `ljl-test-folder-${Date.now()}`);
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

    const result = await quickFolders.openFolder(testDir);
    assert.ok(result.success, 'openFolder should succeed');
    assert.ok(fs.existsSync(testDir), 'Target folder must have been created');

    // Clean up
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  await t.test('TrayManager provides valid menu template and status text', () => {
    const statusText = trayManager.getStatusText();
    assert.ok(typeof statusText === 'string', 'Status text must be a string');
    assert.ok(statusText.startsWith('Status:'), 'Status text must start with "Status:"');

    const template = trayManager.buildMenuTemplate();
    assert.ok(Array.isArray(template), 'Menu template must be an array');
    assert.ok(template.length >= 7, 'Menu must contain multiple items');

    const labels = template.map((item) => item.label).filter(Boolean);
    assert.ok(labels.includes('Open Linux Jagex Launcher'), 'Must include Open item');
    assert.ok(labels.includes('Play RuneScape 3'), 'Must include Play RS3 item');
    assert.ok(labels.includes('Play Old School RuneScape'), 'Must include Play OSRS item');
    assert.ok(labels.includes('Check for Updates...'), 'Must include Updates item');
    assert.ok(labels.includes('Quit'), 'Must include Quit item');
  });

  await t.test('TrayManager quitting state management', () => {
    assert.strictEqual(trayManager.getIsQuitting(), false);
    trayManager.setQuitting(true);
    assert.strictEqual(trayManager.getIsQuitting(), true);
    trayManager.setQuitting(false);
    assert.strictEqual(trayManager.getIsQuitting(), false);
  });
});
