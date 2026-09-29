import test from 'node:test';
import assert from 'node:assert';
import { COMMUNITY_RESOURCES } from '../src/renderer/scripts/resources.ts';

test('Community Resources & Tools Directory Suite', async (t) => {
  await t.test('all resource entries have valid metadata and secure URLs', () => {
    assert.ok(Array.isArray(COMMUNITY_RESOURCES));
    assert.ok(COMMUNITY_RESOURCES.length >= 15, 'Must contain a rich curated directory');

    for (const r of COMMUNITY_RESOURCES) {
      assert.ok(r.id && typeof r.id === 'string', 'Resource must have a string id');
      assert.ok(['rs3', 'osrs', 'dragonwilds'].includes(r.game), `Invalid game for ${r.id}: ${r.game}`);
      assert.ok(r.title && r.title.length > 2, `Resource ${r.id} must have a valid title`);
      assert.ok(r.category && r.category.length > 2, `Resource ${r.id} must have a category`);
      assert.ok(r.icon && r.icon.length > 0, `Resource ${r.id} must have an icon`);
      assert.ok(r.icon.startsWith('<svg') && r.icon.endsWith('</svg>'), `Resource ${r.id} must have a vector SVG icon`);

      // Verify URL is a well-formed HTTPS URL
      assert.ok(r.url.startsWith('https://'), `Resource ${r.id} must use secure HTTPS: ${r.url}`);
      assert.doesNotThrow(() => new URL(r.url), `Resource ${r.id} URL must be parseable: ${r.url}`);
    }
  });

  await t.test('contains comprehensive coverage for RuneScape 3', () => {
    const rs3Items = COMMUNITY_RESOURCES.filter(r => r.game === 'rs3');
    assert.ok(rs3Items.length >= 7, 'RS3 must have at least 7 primary tools');

    const urls = rs3Items.map(r => r.url);
    assert.ok(urls.includes('https://runescape.wiki/'), 'Must include RS3 Official Wiki');
    assert.ok(urls.includes('https://github.com/Jcapehart2/RuneKit-Reforged'), 'Must include RuneKit Reforged');
    assert.ok(urls.includes('https://github.com/arroquw/alt1-electron'), 'Must include alt1-electron');
    assert.ok(urls.includes('https://pvme.io/'), 'Must include PvM Encyclopedia');
    assert.ok(urls.includes('https://www.ely.gg/'), 'Must include Ely.gg');
  });

  await t.test('contains comprehensive coverage for Old School RuneScape', () => {
    const osrsItems = COMMUNITY_RESOURCES.filter(r => r.game === 'osrs');
    assert.ok(osrsItems.length >= 6, 'OSRS must have at least 6 primary tools');

    const urls = osrsItems.map(r => r.url);
    assert.ok(urls.includes('https://oldschool.runescape.wiki/'), 'Must include OSRS Official Wiki');
    assert.ok(urls.includes('https://tools.runescape.wiki/osrs-dps/'), 'Must include OSRS Wiki DPS Calculator');
    assert.ok(urls.includes('https://www.ge-tracker.com/'), 'Must include GE Tracker');
    assert.ok(urls.includes('https://github.com/Zoinkwiz/quest-helper'), 'Must include Quest Helper');
  });

  await t.test('contains comprehensive coverage for RuneScape: Dragonwilds', () => {
    const dwItems = COMMUNITY_RESOURCES.filter(r => r.game === 'dragonwilds');
    assert.ok(dwItems.length >= 4, 'Dragonwilds must have at least 4 primary tools');

    const urls = dwItems.map(r => r.url);
    assert.ok(urls.includes('https://dragonwilds.runescape.wiki/'), 'Must include Dragonwilds Official Wiki');
    assert.ok(urls.includes('https://mapgenie.io/runescape-dragonwilds'), 'Must include Dragonwilds Interactive Map');
    assert.ok(urls.includes('https://store.steampowered.com/app/1374490/RuneScape_Dragonwilds/'), 'Must include Steam Community Hub');
  });
});
