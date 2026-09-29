#!/usr/bin/env bash
# ==============================================================================
# Linux Jagex Launcher - Launchpad PPA Source Package Builder & Uploader
# ==============================================================================
set -euo pipefail

PPA_TARGET="${1:-ppa:cook0001/ppa}"
SERIES="${2:-noble}" # noble (24.04 LTS), jammy (22.04 LTS)
GPG_KEY="${3:-}"

VERSION="1.0.0"
PKG_NAME="linux-jagex-launcher"
BUILD_DIR="$(mktemp -d -t ppa-build-XXXXXX)"

echo "=========================================================="
echo " Packaging: ${PKG_NAME} ${VERSION} for ${SERIES}"
echo " PPA Target: ${PPA_TARGET}"
echo " Workspace:  ${BUILD_DIR}"
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 1. Prepare pristine source archive
SOURCE_DIR="${BUILD_DIR}/${PKG_NAME}-${VERSION}"
mkdir -p "${SOURCE_DIR}"

echo "==> Copying project source files..."
rsync -a --exclude='.git' \
         --exclude='node_modules' \
         --exclude='dist' \
         --exclude='release' \
         --exclude='build-dir' \
         "${REPO_ROOT}/" "${SOURCE_DIR}/"

# 2. Inject debian/ directory
echo "==> Configuring debian packaging metadata for ${SERIES}..."
cp -r "${SCRIPT_DIR}/debian" "${SOURCE_DIR}/"

# Update changelog distribution series
sed -i.bak -E "1s/\) [a-z]+;/\) ${SERIES};/" "${SOURCE_DIR}/debian/changelog"
rm -f "${SOURCE_DIR}/debian/changelog.bak"

# 3. Create orig.tar.gz tarball
echo "==> Creating orig.tar.gz tarball..."
tar -czf "${BUILD_DIR}/${PKG_NAME}_${VERSION}.orig.tar.gz" -C "${BUILD_DIR}" "${PKG_NAME}-${VERSION}"

# 4. Build signed Debian source package
echo "==> Running debuild (source-only build)..."
cd "${SOURCE_DIR}"

DEBUILD_ARGS=(-S -sa)
if [[ -n "${GPG_KEY}" ]]; then
  DEBUILD_ARGS+=("-k${GPG_KEY}")
fi

debuild "${DEBUILD_ARGS[@]}"

echo "==> Source package successfully built in ${BUILD_DIR}:"
ls -la "${BUILD_DIR}"/*.dsc "${BUILD_DIR}"/*_source.changes

CHANGES_FILE="$(ls -1 "${BUILD_DIR}"/*_source.changes | head -n1)"

echo ""
echo "=========================================================="
echo " Ready to upload to Launchpad!"
echo " Command:"
echo "   dput ${PPA_TARGET} ${CHANGES_FILE}"
echo "=========================================================="

read -p "Upload now with dput? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  dput "${PPA_TARGET}" "${CHANGES_FILE}"
  echo "==> Successfully uploaded to ${PPA_TARGET}!"
  echo "Monitor build progress at: https://launchpad.net/~${PPA_TARGET#ppa:}"
fi
