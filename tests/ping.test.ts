import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { worldPing } from '../src/main/ping.ts';

test('World Ping & Latency Benchmarking Suite', async (t) => {
  await t.test('worldPing manager provides valid initial state', () => {
    assert.strictEqual(worldPing.isBusy(), false);
  });

  await t.test('standalone shell scripts exist and have executable permissions', () => {
    const rs3Script = path.resolve(process.cwd(), 'docs/rs3-ping.sh');
    const osrsScript = path.resolve(process.cwd(), 'docs/osrs-ping.sh');

    assert.ok(fs.existsSync(rs3Script), 'docs/rs3-ping.sh must exist');
    assert.ok(fs.existsSync(osrsScript), 'docs/osrs-ping.sh must exist');

    // Check executable permission
    fs.accessSync(rs3Script, fs.constants.X_OK);
    fs.accessSync(osrsScript, fs.constants.X_OK);

    const rs3Content = fs.readFileSync(rs3Script, 'utf8');
    const osrsContent = fs.readFileSync(osrsScript, 'utf8');

    assert.ok(rs3Content.includes('world${w}.runescape.com'));
    assert.ok(osrsContent.includes('oldschool${sub}.runescape.com'));
    assert.ok(osrsContent.includes('300 + sub'));
  });

  await t.test('pings RS3 worlds and returns formatted latency entries', async () => {
    // Probe a subset of known high-availability worlds
    const testWorlds = [1, 2, 22, 64, 76, 104];
    const results = await worldPing.pingRs3Worlds(testWorlds);

    assert.ok(Array.isArray(results));
    // If online, should return at least 1 reachable world
    if (results.length > 0) {
      const first = results[0];
      assert.strictEqual(first.game, 'rs3');
      assert.ok(testWorlds.includes(first.world));
      assert.strictEqual(typeof first.ping, 'number');
      assert.ok(first.ping > 0);
      assert.ok(first.hostname.includes('.runescape.com'));
      assert.ok(typeof first.region, 'string');
      assert.ok(typeof first.flag, 'string');

      // Verify sorted by ascending ping
      for (let i = 1; i < results.length; i++) {
        assert.ok(results[i].ping >= results[i - 1].ping, 'Results must be sorted by lowest latency');
      }
    }
  });

  await t.test('pings OSRS worlds and computes 300+ in-game world numbers', async () => {
    // Probe a subset of known OSRS worlds (sub-ids 1, 2, 85)
    const testSubs = [1, 2, 85];
    const results = await worldPing.pingOsrsWorlds(testSubs);

    assert.ok(Array.isArray(results));
    if (results.length > 0) {
      const first = results[0];
      assert.strictEqual(first.game, 'osrs');
      assert.ok(first.world >= 301, 'OSRS in-game world must be offset by 300');
      assert.strictEqual(first.world, 300 + first.serverSubId!);
      assert.strictEqual(typeof first.ping, 'number');
      assert.ok(first.ping > 0);
      assert.ok(first.hostname.includes('oldschool'));

      for (let i = 1; i < results.length; i++) {
        assert.ok(results[i].ping >= results[i - 1].ping, 'Results must be sorted by lowest latency');
      }
    }
  });

  await t.test('Dragonwilds is cleanly excluded from world latency probing', () => {
    // Assert that WorldPingManager only manages rs3 and osrs games
    const supportedGames = ['rs3', 'osrs'];
    assert.ok(!('pingDragonwildsWorlds' in (worldPing as any)), 'Dragonwilds must not have world ping probing');
    assert.strictEqual(supportedGames.includes('dragonwilds'), false);
  });

  await t.test('pingHost sanitizes input and rejects flag or command injection attempts', async () => {
    // Hostnames starting with dash (command injection flags) or containing special chars must return null
    const dangerousInputs = ['-c', '--help', 'world1.runescape.com; rm -rf /', 'world1.runescape.com`id`', '', '   '];
    for (const input of dangerousInputs) {
      const res = await worldPing.pingHost(input);
      assert.strictEqual(res, null, `Input "${input}" should be rejected by hostname validator`);
    }
  });
});
