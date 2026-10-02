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
    assert.ok(content.includes('release/*.snap'), 'workflow must upload snap to release');
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

    const builderScript = fs.readFileSync(path.join(ppaDir, 'build-source-package.sh'), 'utf8');
    assert.ok(builderScript.includes('Cooling down 30s between series'), 'Must include 30-second cooldown between series');
    assert.ok(builderScript.includes('sleep 30'), 'Must execute sleep 30 between series');
    assert.ok(builderScript.includes('MAX_RETRIES='), 'Must define MAX_RETRIES for automatic retry loop');
    assert.ok(builderScript.includes('RETRY_DELAY=30'), 'Must define RETRY_DELAY of 30s for automatic retry loop');
    assert.ok(builderScript.includes('Initiating dput upload with automatic retry loop'), 'Must execute dput with retry loop');
  });

  await t.test('Snap packaging specification and configuration', () => {
    const snapDir = path.resolve(process.cwd(), 'packaging/snap');
    const snapcraftYaml = path.join(snapDir, 'snapcraft.yaml');
    const snapReadme = path.join(snapDir, 'README.md');
    const rootSnapcraft = path.resolve(process.cwd(), 'snap/snapcraft.yaml');

    assert.ok(fs.existsSync(snapcraftYaml), 'packaging/snap/snapcraft.yaml must exist');
    assert.ok(fs.existsSync(snapReadme), 'packaging/snap/README.md must exist');
    assert.ok(fs.existsSync(rootSnapcraft), 'snap/snapcraft.yaml must exist');

    // Verify Snapcraft GUI desktop entry and icon assets
    assert.ok(fs.existsSync(path.join(snapDir, 'gui/linux-jagex-launcher.desktop')), 'packaging/snap/gui desktop entry must exist');
    assert.ok(fs.existsSync(path.join(snapDir, 'gui/icon.png')), 'packaging/snap/gui/icon.png must exist');
    assert.ok(fs.existsSync(path.resolve(process.cwd(), 'snap/gui/linux-jagex-launcher.desktop')), 'snap/gui desktop entry must exist');
    assert.ok(fs.existsSync(path.resolve(process.cwd(), 'snap/gui/icon.png')), 'snap/gui/icon.png must exist');
    
    // Internal maintainer banner generator script
    const internalBannerGen = path.resolve(process.cwd(), 'internal/scripts/generate-snap-banner.cjs');
    if (fs.existsSync(internalBannerGen)) {
      assert.ok(fs.existsSync(internalBannerGen), 'internal/scripts/generate-snap-banner.cjs must exist');
    }

    const yamlContent = fs.readFileSync(snapcraftYaml, 'utf8');
    assert.ok(yamlContent.includes('name: linux-jagex-launcher'), 'Snap name must be linux-jagex-launcher');
    assert.ok(yamlContent.includes('confinement: strict'), 'Snap confinement must be strict');
    assert.ok(yamlContent.includes('removable-media'), 'Must declare removable-media plug');
    assert.ok(yamlContent.includes('joystick'), 'Must declare joystick plug');
    assert.ok(yamlContent.includes('process-control'), 'Must declare process-control plug');
    assert.ok(yamlContent.includes('network-bind'), 'Must declare network-bind plug');

    const builderConfigPath = path.resolve(process.cwd(), 'electron-builder.json');
    const builderConfig = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));
    assert.ok(builderConfig.snap, 'electron-builder.json must include snap configuration');
    assert.strictEqual(builderConfig.snap.confinement, 'strict', 'electron-builder snap must use strict confinement');

    // Verify documentation and website have Snap instructions
    const readme = fs.readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf8');
    assert.ok(readme.includes('sudo snap install linux-jagex-launcher'), 'README.md must contain snap install command');
    assert.ok(readme.includes('linux-jagex-launcher:joystick'), 'README.md must document snap joystick plug');

    const websiteHtml = fs.readFileSync(path.resolve(process.cwd(), 'docs/index.html'), 'utf8');
    assert.ok(websiteHtml.includes('id="tab-panel-snap"'), 'docs/index.html must contain Snap install tab panel');
    assert.ok(websiteHtml.includes('sudo snap install linux-jagex-launcher'), 'docs/index.html must contain snap install command');
    assert.ok(websiteHtml.includes('assets/banner.png'), 'docs/index.html must display launcher banner in snap section');
  });

  await t.test('Debian (.deb) packaging and repository configuration', () => {
    const debDir = path.resolve(process.cwd(), 'packaging/deb');
    assert.ok(fs.existsSync(debDir), 'packaging/deb directory must exist');
    assert.ok(fs.existsSync(path.join(debDir, 'README.md')), 'packaging/deb/README.md must exist');
    assert.ok(pkg.scripts['dist:deb'], 'package.json must define dist:deb script');

    const internalAptScript = path.resolve(process.cwd(), 'internal/scripts/generate-apt-repo.js');
    if (fs.existsSync(internalAptScript)) {
      assert.ok(fs.existsSync(internalAptScript), 'internal/scripts/generate-apt-repo.js must exist');
    }

    const builderConfigPath = path.resolve(process.cwd(), 'electron-builder.json');
    const builderConfig = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));
    assert.ok(builderConfig.deb, 'electron-builder.json must include deb configuration');
    assert.strictEqual(builderConfig.deb.packageName, 'jagex-launcher');
    assert.ok(builderConfig.deb.depends.some((d: string) => d.includes('libgtk-3-0')));
    assert.ok(builderConfig.deb.depends.some((d: string) => d.includes('libasound2')));
  });

  await t.test('Snap Store media and banner specifications', async () => {
    const internalBannerDir = path.resolve(process.cwd(), 'internal/banners');
    if (!fs.existsSync(internalBannerDir)) {
      return; // Skip when running in clean CI checkout without internal/ assets
    }

    const sharp = (await import('sharp')).default;
    const bannerPng = path.join(internalBannerDir, 'snap-store-banner.png');
    const bannerJpg = path.join(internalBannerDir, 'snap-store-banner.jpg');
    const bannerMaxJpg = path.join(internalBannerDir, 'snap-store-banner-4320x1440.jpg');

    assert.ok(fs.existsSync(bannerPng), 'snap-store-banner.png must exist');
    assert.ok(fs.existsSync(bannerJpg), 'snap-store-banner.jpg must exist');
    assert.ok(fs.existsSync(bannerMaxJpg), 'snap-store-banner-4320x1440.jpg must exist');

    const banners = [bannerPng, bannerJpg, bannerMaxJpg];
    for (const file of banners) {
      const meta = await sharp(file).metadata();
      const stat = fs.statSync(file);

      // 1. Accepted image formats: JPEG & PNG
      assert.ok(['png', 'jpeg'].includes(meta.format!), `Format must be png or jpeg, got ${meta.format}`);

      // 2. Min resolution: 720 x 240 pixels
      assert.ok(meta.width! >= 720, `Width ${meta.width} must be >= 720`);
      assert.ok(meta.height! >= 240, `Height ${meta.height} must be >= 240`);

      // 3. Max resolution: 4320 x 1440 pixels
      assert.ok(meta.width! <= 4320, `Width ${meta.width} must be <= 4320`);
      assert.ok(meta.height! <= 1440, `Height ${meta.height} must be <= 1440`);

      // 4. Aspect ratio: exactly 3:1
      const ratio = meta.width! / meta.height!;
      assert.strictEqual(ratio.toFixed(2), '3.00', `Aspect ratio must be exactly 3:1, got ${ratio}`);

      // 5. File size limit: 2MB (2,097,152 bytes)
      assert.ok(stat.size < 2 * 1024 * 1024, `File size ${stat.size} bytes must be under 2MB`);
    }
  });

  await t.test('Arch User Repository (AUR) packaging specification', () => {
    const aurDir = path.resolve(process.cwd(), 'packaging/aur');
    const pkgbuildPath = path.join(aurDir, 'PKGBUILD');
    const srcinfoPath = path.join(aurDir, '.SRCINFO');
    const buildScriptPath = path.join(aurDir, 'build-aur-package.sh');
    const readmePath = path.join(aurDir, 'README.md');

    assert.ok(fs.existsSync(pkgbuildPath), 'PKGBUILD must exist');
    assert.ok(fs.existsSync(srcinfoPath), '.SRCINFO must exist');
    assert.ok(fs.existsSync(buildScriptPath), 'build-aur-package.sh must exist');
    assert.ok(fs.existsSync(readmePath), 'packaging/aur/README.md must exist');

    const pkgbuild = fs.readFileSync(pkgbuildPath, 'utf8');
    const srcinfo = fs.readFileSync(srcinfoPath, 'utf8');
    const readme = fs.readFileSync(readmePath, 'utf8');

    assert.ok(pkgbuild.includes(`pkgver=${pkg.version}`), `PKGBUILD must match package version ${pkg.version}`);
    assert.ok(srcinfo.includes(`pkgver = ${pkg.version}`), `.SRCINFO must match package version ${pkg.version}`);
    assert.ok(pkgbuild.includes('depends='), 'PKGBUILD must declare runtime dependencies');
    assert.ok(pkgbuild.includes('optdepends='), 'PKGBUILD must declare optional dependencies');
    assert.ok(readme.includes('pacman -U'), 'README must document standalone pacman installation');
  });

  await t.test('Steam Deck turnkey installer script specification', () => {
    const deckInstallScript = path.resolve(process.cwd(), 'docs/deck-install.sh');
    assert.ok(fs.existsSync(deckInstallScript), 'docs/deck-install.sh must exist');

    const scriptContent = fs.readFileSync(deckInstallScript, 'utf8');
    assert.ok(scriptContent.includes(`LATEST_TAG="v${pkg.version}"`), `deck-install.sh fallback tag must be v${pkg.version}`);
    assert.ok(scriptContent.includes('shortcuts.vdf'), 'deck-install.sh must handle Steam shortcuts.vdf');
    assert.ok(scriptContent.includes('shortcuts_file'), 'deck-install.sh must define shortcuts_file');
  });

  await t.test('Fedora RPM & Copr packaging specification', () => {
    const rpmDir = path.resolve(process.cwd(), 'packaging/rpm');
    const specPath = path.join(rpmDir, 'linux-jagex-launcher.spec');
    const readmePath = path.join(rpmDir, 'README.md');

    assert.ok(fs.existsSync(rpmDir), 'packaging/rpm directory must exist');
    assert.ok(fs.existsSync(specPath), 'packaging/rpm/linux-jagex-launcher.spec must exist');
    assert.ok(fs.existsSync(readmePath), 'packaging/rpm/README.md must exist');

    const specContent = fs.readFileSync(specPath, 'utf8');
    assert.ok(specContent.includes(`Version:        ${pkg.version}`), `linux-jagex-launcher.spec must contain version ${pkg.version}`);
    assert.ok(specContent.includes('Requires:'), 'specfile must declare runtime requirements');
    assert.ok(specContent.includes('Provides:       jagex-launcher'), 'specfile must provide jagex-launcher alias');
    assert.ok(specContent.includes('Conflicts:      jagex-launcher'), 'specfile must declare conflict with jagex-launcher');
  });

  await t.test('Packaging release version parity across all formats', () => {
    // 1. Flatpak metainfo has current release
    const metainfoPath = path.resolve(process.cwd(), 'packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.metainfo.xml');
    const metainfo = fs.readFileSync(metainfoPath, 'utf8');
    assert.ok(metainfo.includes(`<release version="${pkg.version}"`), `metainfo.xml must contain release version ${pkg.version}`);

    // 2. Flatpak manifest has current tag
    const flatpakManifestPath = path.resolve(process.cwd(), 'packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.yml');
    const flatpakManifest = fs.readFileSync(flatpakManifestPath, 'utf8');
    assert.ok(flatpakManifest.includes(`tag: v${pkg.version}`), `Flatpak manifest must reference tag v${pkg.version}`);

    // 3. Debian PPA changelog has current version
    const changelogPath = path.resolve(process.cwd(), 'packaging/ppa/debian/changelog');
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    assert.ok(changelog.includes(`linux-jagex-launcher (${pkg.version}-`), `debian/changelog must contain version ${pkg.version}`);

    // 4. Snapcraft configs have current version
    const rootSnapPath = path.resolve(process.cwd(), 'snap/snapcraft.yaml');
    const rootSnap = fs.readFileSync(rootSnapPath, 'utf8');
    assert.ok(rootSnap.includes(`version: '${pkg.version}'`), `snap/snapcraft.yaml must contain version ${pkg.version}`);

    // 5. Fedora RPM specfile has current version
    const specPath = path.resolve(process.cwd(), 'packaging/rpm/linux-jagex-launcher.spec');
    const specContent = fs.readFileSync(specPath, 'utf8');
    assert.ok(specContent.includes(`Version:        ${pkg.version}`), `linux-jagex-launcher.spec must contain version ${pkg.version}`);
  });
});


