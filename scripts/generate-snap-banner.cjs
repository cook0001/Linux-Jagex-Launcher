// Forwarding wrapper for packaging/snap/generate-snap-banner.cjs
const bannerGen = require('../packaging/snap/generate-snap-banner.cjs');

if (require.main === module) {
  bannerGen.main().catch(err => {
    console.error('Failed to generate snap banner:', err);
    process.exit(1);
  });
}

module.exports = bannerGen;
