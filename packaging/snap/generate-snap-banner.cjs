const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

function findRepoRoot() {
  let curr = __dirname;
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, 'package.json'))) return curr;
    curr = path.dirname(curr);
  }
  return process.cwd();
}

async function createSnapStoreBanner({ width, height }) {
  const repoRoot = findRepoRoot();
  const bgPath = path.join(repoRoot, 'docs/assets/banner.png');
  const iconPath = path.join(repoRoot, 'resources/icons/1024x1024.png');

  // Scale factors relative to 2160x720 baseline
  const scale = width / 2160;

  // Process background image: fill aspect ratio 3:1
  const bgBuffer = await sharp(bgPath)
    .resize(width, height, {
      fit: 'cover',
      position: 'center'
    })
    .modulate({
      brightness: 0.72,
      saturation: 1.18
    })
    .toBuffer();

  // Resize Tux emblem
  const iconSize = Math.round(390 * scale);
  const iconBuffer = await sharp(iconPath)
    .resize(iconSize, iconSize, { fit: 'contain' })
    .toBuffer();

  const iconBase64 = `data:image/png;base64,${iconBuffer.toString('base64')}`;

  const iconX = Math.round(110 * scale);
  const iconY = Math.round(165 * scale);
  const iconCenter = Math.round(iconSize / 2);
  const glowRadius = Math.round(230 * scale);

  const textX = Math.round(550 * scale);
  const textY = Math.round(145 * scale);

  const kickerW = Math.round(310 * scale);
  const kickerH = Math.round(34 * scale);
  const kickerR = Math.round(17 * scale);
  const kickerDotX = Math.round(18 * scale);
  const kickerDotY = Math.round(17 * scale);
  const kickerDotR = Math.round(4 * scale);
  const kickerTextX = Math.round(32 * scale);
  const kickerTextY = Math.round(22 * scale);
  const kickerFontSize = Math.round(13 * scale);

  const titleY = Math.round(145 * scale);
  const titleFontSize = Math.round(64 * scale);

  const subY = Math.round(200 * scale);
  const subFontSize = Math.round(22 * scale);

  const badgesY = Math.round(245 * scale);
  const badgeH = Math.round(42 * scale);
  const badgeR = Math.round(8 * scale);
  const badgeTextY = Math.round(26 * scale);
  const badgeFontSize = Math.round(15 * scale);

  // Badges metadata: label and proportional widths
  const badgeData = [
    { label: 'RuneScape 3 (NXT)', width: Math.round(200 * scale) },
    { label: 'Old School (RuneLite / HDOS)', width: Math.round(285 * scale) },
    { label: 'RuneScape: Dragonwilds', width: Math.round(230 * scale) },
    { label: 'OAuth 2.0 PKCE', width: Math.round(165 * scale) },
    { label: 'Steam Deck Verified', width: Math.round(195 * scale) }
  ];

  let currentBadgeX = textX;
  const badgeSvgElements = badgeData.map(b => {
    const el = `
      <g transform="translate(${currentBadgeX}, ${badgesY})">
        <rect width="${b.width}" height="${badgeH}" rx="${badgeR}" fill="rgba(15, 23, 42, 0.72)" stroke="rgba(229, 179, 82, 0.45)" stroke-width="${Math.max(1, Math.round(1.5 * scale))}" filter="url(#drop-shadow)" />
        <text x="${Math.round(b.width / 2)}" y="${badgeTextY}" fill="#f1f5f9" font-family="'DejaVu Sans', 'Ubuntu', 'Liberation Sans', sans-serif" font-size="${badgeFontSize}px" font-weight="600" text-anchor="middle">${b.label}</text>
      </g>
    `;
    currentBadgeX += b.width + Math.round(14 * scale);
    return el;
  }).join('\n');

  const svgOverlay = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Gradients -->
        <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f5e1a4" />
          <stop offset="35%" stop-color="#e5b352" />
          <stop offset="70%" stop-color="#b8860b" />
          <stop offset="100%" stop-color="#8a6100" />
        </linearGradient>

        <linearGradient id="vignette" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#020617" stop-opacity="0.94" />
          <stop offset="32%" stop-color="#020617" stop-opacity="0.82" />
          <stop offset="68%" stop-color="#020617" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#020617" stop-opacity="0.85" />
        </linearGradient>

        <radialGradient id="tux-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.42" />
          <stop offset="45%" stop-color="#0284c7" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0" />
        </radialGradient>

        <radialGradient id="gold-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#e5b352" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#e5b352" stop-opacity="0" />
        </radialGradient>

        <filter id="drop-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="${Math.round(4 * scale)}" stdDeviation="${Math.round(6 * scale)}" flood-color="#000000" flood-opacity="0.6" />
        </filter>
        <filter id="glow-text">
          <feDropShadow dx="0" dy="0" stdDeviation="${Math.round(8 * scale)}" flood-color="#e5b352" flood-opacity="0.5" />
        </filter>
      </defs>

      <!-- Darkening & Vignette Overlay -->
      <rect width="${width}" height="${height}" fill="url(#vignette)" />
      
      <!-- Top and bottom cinematic accent bars -->
      <rect x="0" y="0" width="${width}" height="${Math.round(5 * scale)}" fill="url(#gold-grad)" />
      <rect x="0" y="${height - Math.round(5 * scale)}" width="${width}" height="${Math.round(5 * scale)}" fill="url(#gold-grad)" />

      <!-- Left Aura Behind Tux Icon -->
      <circle cx="${iconX + iconCenter}" cy="${iconY + iconCenter}" r="${glowRadius}" fill="url(#tux-glow)" />
      <circle cx="${iconX + iconCenter}" cy="${iconY + iconCenter}" r="${Math.round(glowRadius * 0.75)}" fill="url(#gold-glow)" />

      <!-- Tux Emblem Outer Ring -->
      <circle cx="${iconX + iconCenter}" cy="${iconY + iconCenter}" r="${Math.round(iconCenter + 14 * scale)}" fill="none" stroke="url(#gold-grad)" stroke-width="${Math.round(3.5 * scale)}" filter="url(#drop-shadow)" />
      <circle cx="${iconX + iconCenter}" cy="${iconY + iconCenter}" r="${Math.round(iconCenter + 7 * scale)}" fill="none" stroke="rgba(255, 255, 255, 0.15)" stroke-width="${Math.round(1.5 * scale)}" />

      <!-- Tux Emblem Image -->
      <image href="${iconBase64}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" filter="url(#drop-shadow)" />

      <!-- Top Kicker Pill (Canonical Snap / Native Linux) -->
      <g transform="translate(${textX}, ${textY - Math.round(65 * scale)})">
        <rect width="${kickerW}" height="${kickerH}" rx="${kickerR}" fill="rgba(16, 185, 129, 0.16)" stroke="rgba(52, 211, 153, 0.45)" stroke-width="${Math.max(1, Math.round(1.5 * scale))}" />
        <circle cx="${kickerDotX}" cy="${kickerDotY}" r="${kickerDotR}" fill="#34d399" />
        <text x="${kickerTextX}" y="${kickerTextY}" fill="#a7f3d0" font-family="'DejaVu Sans', 'Ubuntu', 'Liberation Sans', sans-serif" font-size="${kickerFontSize}px" font-weight="700" letter-spacing="1px">CANONICAL SNAP STORE EDITION</text>
      </g>

      <!-- Main Headline -->
      <text x="${textX}" y="${titleY}" font-family="'Cinzel', 'DejaVu Serif', 'Georgia', serif" font-size="${titleFontSize}px" font-weight="800" fill="url(#gold-grad)" filter="url(#glow-text)" letter-spacing="${Math.round(2 * scale)}px">
        LINUX JAGEX LAUNCHER
      </text>

      <!-- Subtitle -->
      <text x="${textX}" y="${subY}" font-family="'DejaVu Sans', 'Ubuntu', 'Liberation Sans', sans-serif" font-size="${subFontSize}px" font-weight="500" fill="#94a3b8" letter-spacing="${Math.round(0.5 * scale)}px">
        Authentic, Native Game Launcher for RuneScape &amp; Old School on Linux &amp; Steam Deck
      </text>

      <!-- Feature Pill Badges -->
      ${badgeSvgElements}

      <!-- Bottom Right Publisher / Trust Watermark -->
      <g transform="translate(${width - Math.round(260 * scale)}, ${height - Math.round(36 * scale)})">
        <text x="0" y="0" fill="#64748b" font-family="'DejaVu Sans', 'Ubuntu', 'Liberation Sans', sans-serif" font-size="${Math.round(13 * scale)}px" font-weight="600" letter-spacing="0.5px">
          Open Source • Community Edition
        </text>
      </g>
    </svg>
  `;

  return sharp(bgBuffer)
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0
      }
    ]);
}

async function main() {
  const repoRoot = findRepoRoot();
  const snapDir = path.join(repoRoot, 'packaging/snap');
  const docsAssetsDir = path.join(repoRoot, 'docs/assets');

  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  if (!fs.existsSync(docsAssetsDir)) fs.mkdirSync(docsAssetsDir, { recursive: true });

  console.log('Generating Snap Store Banners (Aspect Ratio 3:1)...');

  // Format 1: 2160 x 720 PNG (High-DPI 2x, exact 3:1, < 2MB)
  const banner2160 = await createSnapStoreBanner({ width: 2160, height: 720 });
  const png2160Path = path.join(snapDir, 'snap-store-banner.png');
  await banner2160.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(png2160Path);
  fs.copyFileSync(png2160Path, path.join(docsAssetsDir, 'snap-store-banner.png'));

  // Format 2: 2160 x 720 JPEG (High-DPI 2x, quality 92, < 500KB)
  const jpg2160Banner = await createSnapStoreBanner({ width: 2160, height: 720 });
  const jpg2160Path = path.join(snapDir, 'snap-store-banner.jpg');
  await jpg2160Banner.jpeg({ quality: 92, mozjpeg: true }).toFile(jpg2160Path);
  fs.copyFileSync(jpg2160Path, path.join(docsAssetsDir, 'snap-store-banner.jpg'));

  // Format 3: 4320 x 1440 JPEG (Maximum Snap Store resolution, quality 88, < 2MB)
  const banner4320 = await createSnapStoreBanner({ width: 4320, height: 1440 });
  const jpg4320Path = path.join(snapDir, 'snap-store-banner-4320x1440.jpg');
  await banner4320.jpeg({ quality: 88, mozjpeg: true }).toFile(jpg4320Path);

  // Format 4: 1440 x 480 PNG (Standard 1x resolution, exact 3:1, < 500KB)
  const banner1440 = await createSnapStoreBanner({ width: 1440, height: 480 });
  const png1440Path = path.join(snapDir, 'snap-store-banner-1440x480.png');
  await banner1440.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(png1440Path);

  // Verify and display results
  const files = [png2160Path, jpg2160Path, jpg4320Path, png1440Path];
  for (const f of files) {
    const meta = await sharp(f).metadata();
    const stat = fs.statSync(f);
    const aspect = (meta.width / meta.height).toFixed(2);
    const sizeKB = (stat.size / 1024).toFixed(1);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
    const passesSpecs = meta.width >= 720 && meta.height >= 240 && meta.width <= 4320 && meta.height <= 1440 && aspect === '3.00' && stat.size < 2 * 1024 * 1024;

    console.log(`\nFile: ${path.basename(f)}`);
    console.log(`  Path: ${f}`);
    console.log(`  Dimensions: ${meta.width} x ${meta.height} px (Aspect Ratio: ${aspect}:1)`);
    console.log(`  Format: ${meta.format.toUpperCase()}`);
    console.log(`  Size: ${sizeKB} KB (${sizeMB} MB)`);
    console.log(`  Meets Snap Store Specs: ${passesSpecs ? '✓ PASSED' : '✗ FAILED'}`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Failed to generate snap banner:', err);
    process.exit(1);
  });
}

module.exports = { createSnapStoreBanner, main };
