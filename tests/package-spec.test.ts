import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Repository and package configuration', async (t) => {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  await t.test('package.json has required fields', () => {
    assert.strictEqual(pkg.name, 'linux-jagex-launcher');
    assert.strictEqual(pkg.desktopName, 'linux-jagex-launcher');
    assert.strictEqual(pkg.type, 'module');
    assert.ok(pkg.version);
    assert.ok(pkg.scripts.build);
    assert.ok(pkg.scripts.test);
    assert.ok(pkg.scripts.lint);
    assert.ok(pkg.scripts.typecheck);
  });

  await t.test('electron-builder configuration exists and is valid', () => {
    const builderConfigPath = path.resolve(process.cwd(), 'electron-builder.json');
    assert.ok(fs.existsSync(builderConfigPath), 'electron-builder.json must exist');
    const config = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));
    assert.ok(config.linux.target.includes('AppImage'));
    assert.ok(config.linux.target.includes('deb'));
    assert.strictEqual(config.linux.icon, 'resources/icon.png');
    assert.ok(config.files.includes('resources/**/*'));
  });

  await t.test('Icon suite for launcher, AppImage, and deb packages exists', () => {
    const masterIcon = path.resolve(process.cwd(), 'resources/icon.png');
    const buildIcon = path.resolve(process.cwd(), 'build/icon.png');
    const rendererIcon = path.resolve(process.cwd(), 'src/renderer/assets/icon.png');
    const docsIcon = path.resolve(process.cwd(), 'docs/assets/icon.png');

    assert.ok(fs.existsSync(masterIcon), 'resources/icon.png must exist');
    assert.ok(fs.statSync(masterIcon).size > 10000, 'resources/icon.png must be non-empty');
    assert.ok(fs.existsSync(buildIcon), 'build/icon.png must exist');
    assert.ok(fs.existsSync(rendererIcon), 'src/renderer/assets/icon.png must exist');
    assert.ok(fs.existsSync(docsIcon), 'docs/assets/icon.png must exist');

    const expectedSizes = ['16x16', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512', '1024x1024'];
    for (const size of expectedSizes) {
      const resPath = path.resolve(process.cwd(), `resources/icons/${size}.png`);
      const buildPath = path.resolve(process.cwd(), `build/icons/${size}.png`);
      assert.ok(fs.existsSync(resPath), `resources/icons/${size}.png must exist for deb/AppImage packaging`);
      assert.ok(fs.existsSync(buildPath), `build/icons/${size}.png must exist for electron-builder`);
    }
  });

  await t.test('GitHub Release workflow automation is configured', () => {
    const buildWorkflowPath = path.resolve(process.cwd(), '.github/workflows/build.yml');
    assert.ok(fs.existsSync(buildWorkflowPath), 'build.yml workflow must exist');
    const content = fs.readFileSync(buildWorkflowPath, 'utf8');

    assert.ok(content.includes('types: [published]'), 'workflow must trigger on published releases in Releases tab');
    assert.ok(content.includes("tags:\n      - 'v*'"), 'workflow must trigger on version tag pushes');
    assert.ok(content.includes('softprops/action-gh-release@v2'), 'workflow must publish via action-gh-release');
    assert.ok(content.includes('contents: write'), 'workflow must have contents: write permission');
    assert.ok(content.includes('release/*.AppImage'), 'workflow must upload AppImage to release');
    assert.ok(content.includes('release/*.deb'), 'workflow must upload deb to release');
    assert.ok(content.includes('release/*.tar.gz'), 'workflow must upload tar.gz to release');
    assert.ok(content.includes('SHA256SUMS.txt'), 'workflow must generate and upload SHA-256 checksums to release');
  });
});
