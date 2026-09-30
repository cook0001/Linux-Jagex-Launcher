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
    assert.ok(content.includes('softprops/action-gh-release'), 'workflow must publish via action-gh-release');
    assert.ok(content.includes('contents: write'), 'workflow must have contents: write permission');
    assert.ok(content.includes('release/*.AppImage'), 'workflow must upload AppImage to release');
    assert.ok(content.includes('release/*.deb'), 'workflow must upload deb to release');
    assert.ok(content.includes('release/*.tar.gz'), 'workflow must upload tar.gz to release');
    assert.ok(content.includes('SHA256SUMS.txt'), 'workflow must generate and upload SHA-256 checksums to release');
    assert.ok(content.includes('concurrency:'), 'workflow must configure concurrency');
    assert.ok(content.includes('cancel-in-progress: true'), 'workflow must cancel previous in-progress jobs');
  });

  await t.test('Flathub submission and packaging compliance', () => {
    const flatpakDir = path.resolve(process.cwd(), 'packaging/flatpak');
    const manifestPath = path.join(flatpakDir, 'io.github.cook0001.LinuxJagexLauncher.yml');
    const metainfoPath = path.join(flatpakDir, 'io.github.cook0001.LinuxJagexLauncher.metainfo.xml');
    const desktopPath = path.join(flatpakDir, 'io.github.cook0001.LinuxJagexLauncher.desktop');

    assert.ok(fs.existsSync(manifestPath), 'Flatpak manifest must exist');
    assert.ok(fs.existsSync(metainfoPath), 'AppStream metainfo.xml must exist');
    assert.ok(fs.existsSync(desktopPath), 'Desktop entry must exist');

    const manifest = fs.readFileSync(manifestPath, 'utf8');
    const metainfo = fs.readFileSync(metainfoPath, 'utf8');
    const desktop = fs.readFileSync(desktopPath, 'utf8');

    // 1. App ID consistency
    const expectedAppId = 'io.github.cook0001.LinuxJagexLauncher';
    assert.ok(manifest.includes(`app-id: ${expectedAppId}`), 'Manifest must declare canonical app-id');
    assert.ok(metainfo.includes(`<id>${expectedAppId}</id>`), 'Metainfo must declare canonical id');
    assert.ok(desktop.includes(`Icon=${expectedAppId}`), 'Desktop file must reference app-id icon');
    assert.ok(metainfo.includes(`<launchable type="desktop-id">${expectedAppId}.desktop</launchable>`), 'Metainfo must reference desktop entry');

    // 2. Metainfo Quality Guidelines
    assert.ok(metainfo.includes('<metadata_license>CC0-1.0</metadata_license>'), 'Metadata license must be CC0-1.0 or FSFAP');
    assert.ok(metainfo.includes('<project_license>MIT</project_license>'), 'Project license must be MIT');
    assert.ok(metainfo.includes('<branding>'), 'Metainfo must include branding block for Flathub Quality Guidelines');
    assert.ok(metainfo.includes('scheme_preference="light"'), 'Branding must have light scheme color');
    assert.ok(metainfo.includes('scheme_preference="dark"'), 'Branding must have dark scheme color');
    assert.ok(metainfo.includes('<categories>'), 'Metainfo must define categories');
    assert.ok(metainfo.includes('<screenshots>'), 'Metainfo must include screenshots');
    assert.ok(metainfo.includes('<content_rating type="oars-1.1" />'), 'Metainfo must define OARS 1.1 content rating');
    assert.ok(metainfo.includes('<releases>'), 'Metainfo must define releases');

    // Summary validation (must not end with period, under 111 chars)
    const summaryMatch = metainfo.match(/<summary>([^<]+)<\/summary>/);
    assert.ok(summaryMatch, 'Metainfo must have a summary tag');
    const summaryText = summaryMatch[1].trim();
    assert.ok(!summaryText.endsWith('.'), 'AppStream summary must not end with a period');
    assert.ok(summaryText.length <= 111, 'AppStream summary must be <= 111 characters');

    // 3. Manifest Runtime and Permissions
    assert.ok(manifest.includes("base: org.electronjs.Electron2.BaseApp"), 'Manifest must specify Electron BaseApp');
    assert.ok(manifest.includes("runtime: org.freedesktop.Platform"), 'Manifest must specify freedesktop runtime');
    assert.ok(manifest.includes("--socket=x11"), 'Manifest must grant X11 access');
    assert.ok(manifest.includes("--socket=wayland"), 'Manifest must grant Wayland access');
    assert.ok(manifest.includes("--device=dri"), 'Manifest must grant DRI GPU acceleration');
    assert.ok(manifest.includes("--socket=pulseaudio"), 'Manifest must grant audio access');
    assert.ok(manifest.includes("--share=network"), 'Manifest must grant network access');

    // 4. Desktop entry compliance
    assert.ok(desktop.includes('[Desktop Entry]'), 'Desktop file must have standard header');
    assert.ok(desktop.includes('Type=Application'), 'Desktop file must be Type=Application');
    assert.ok(desktop.includes('Categories=Game;RolePlaying;'), 'Desktop file must have valid FreeDesktop categories');
  });

  await t.test('Launchpad PPA packaging specification and files', () => {
    const ppaDir = path.resolve(process.cwd(), 'packaging/ppa');
    const debianDir = path.join(ppaDir, 'debian');

    assert.ok(fs.existsSync(path.join(ppaDir, 'README.md')), 'PPA README guide must exist');
    assert.ok(fs.existsSync(path.join(ppaDir, 'build-source-package.sh')), 'PPA builder script must exist');
    assert.ok(fs.existsSync(path.join(debianDir, 'control')), 'debian/control must exist');
    assert.ok(fs.existsSync(path.join(debianDir, 'rules')), 'debian/rules must exist');
    assert.ok(fs.existsSync(path.join(debianDir, 'changelog')), 'debian/changelog must exist');
    assert.ok(fs.existsSync(path.join(debianDir, 'copyright')), 'debian/copyright must exist');
    assert.ok(fs.existsSync(path.join(debianDir, 'install')), 'debian/install must exist');
    assert.ok(fs.existsSync(path.join(debianDir, 'source/format')), 'debian/source/format must exist');

    assert.ok(fs.existsSync(path.join(ppaDir, 'linux-jagex-launcher')), 'Binary wrapper packaging/ppa/linux-jagex-launcher must exist');
    assert.ok(fs.statSync(path.join(ppaDir, 'linux-jagex-launcher')).mode & 0o111, 'Binary wrapper must be executable');

    const control = fs.readFileSync(path.join(debianDir, 'control'), 'utf8');
    assert.ok(control.includes('Package: linux-jagex-launcher'));
    assert.ok(control.includes('Architecture: amd64'));
    assert.ok(control.includes('Build-Depends: debhelper-compat (= 13)'));

    const changelog = fs.readFileSync(path.join(debianDir, 'changelog'), 'utf8');
    assert.ok(changelog.includes('linux-jagex-launcher'));
    assert.ok(changelog.includes('noble; urgency=medium'));

    const format = fs.readFileSync(path.join(debianDir, 'source/format'), 'utf8');
    assert.strictEqual(format.trim(), '3.0 (quilt)');
  });
});

