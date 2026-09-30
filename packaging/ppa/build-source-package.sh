#!/usr/bin/env bash
# ==============================================================================
# Linux Jagex Launcher - Launchpad PPA Source Package Builder & Uploader
# ==============================================================================
set -euo pipefail

PPA_TARGET=""
SERIES=""
GPG_KEY=""
NON_INTERACTIVE=false

POSITIONAL_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --non-interactive|-y)
      NON_INTERACTIVE=true
      ;;
    -k*)
      GPG_KEY="${arg#-k}"
      ;;
    --key=*)
      GPG_KEY="${arg#*=}"
      ;;
    *)
      POSITIONAL_ARGS+=("$arg")
      ;;
  esac
done

PPA_TARGET="${POSITIONAL_ARGS[0]:-ppa:danielcook2016/linux-jagex-launcher}"
SERIES="${POSITIONAL_ARGS[1]:-noble}"
if [[ -z "${GPG_KEY}" && ${#POSITIONAL_ARGS[@]} -ge 3 ]]; then
  GPG_KEY="${POSITIONAL_ARGS[2]}"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

VERSION="$(node -p "require('${REPO_ROOT}/package.json').version")"
PKG_NAME="linux-jagex-launcher"
BUILD_DIR="$(mktemp -d -t ppa-build-XXXXXX)"

echo "=========================================================="
echo " Packaging: ${PKG_NAME} ${VERSION} for Ubuntu ${SERIES}"
echo " PPA Target: ${PPA_TARGET}"
echo " Workspace:  ${BUILD_DIR}"
echo "=========================================================="

# 1. Ensure Electron Linux distribution is compiled
UNPACKED_DIR="${REPO_ROOT}/release/linux-unpacked"
if [[ ! -d "${UNPACKED_DIR}" || ! -f "${UNPACKED_DIR}/linux-jagex-launcher" ]]; then
  echo "==> Building Electron Linux unpacked distribution..."
  (cd "${REPO_ROOT}" && npm run build && npx electron-builder --linux --dir)
fi

# 2. Prepare upstream source directory
SOURCE_DIR="${BUILD_DIR}/${PKG_NAME}-${VERSION}"
mkdir -p "${SOURCE_DIR}/usr/lib/linux-jagex-launcher"

echo "==> Staging application files and assets..."
# Copy the compiled unpacked binary bundle into usr/lib/linux-jagex-launcher/
cp -a "${UNPACKED_DIR}/." "${SOURCE_DIR}/usr/lib/linux-jagex-launcher/"

# Copy packaging and resource files
mkdir -p "${SOURCE_DIR}/packaging/ppa"
mkdir -p "${SOURCE_DIR}/packaging/flatpak"
mkdir -p "${SOURCE_DIR}/resources"

cp -a "${REPO_ROOT}/packaging/ppa/linux-jagex-launcher" "${SOURCE_DIR}/packaging/ppa/" 2>/dev/null || true
cp -a "${REPO_ROOT}/packaging/ppa/linux-jagex-launcher.sh" "${SOURCE_DIR}/packaging/ppa/" 2>/dev/null || true
cp -a "${REPO_ROOT}/packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.desktop" "${SOURCE_DIR}/packaging/flatpak/"
cp -a "${REPO_ROOT}/packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.metainfo.xml" "${SOURCE_DIR}/packaging/flatpak/"
cp -a "${REPO_ROOT}/resources/icons" "${SOURCE_DIR}/resources/"
cp -a "${REPO_ROOT}/resources/icon.png" "${SOURCE_DIR}/resources/" 2>/dev/null || true
cp -a "${REPO_ROOT}/LICENSE" "${SOURCE_DIR}/"

# 3. Create pristine orig.tar.gz tarball BEFORE debian/ is added (Debian 3.0 quilt compliance)
# Uses deterministic mtime, sort, and gzip -n to ensure identical checksum across multi-series builds
echo "==> Creating reproducible orig.tar.gz tarball..."
tar --sort=name --mtime="2026-01-01 00:00:00Z" --owner=root:0 --group=root:0 --exclude-vcs -cf - -C "${BUILD_DIR}" "${PKG_NAME}-${VERSION}" | gzip -n > "${BUILD_DIR}/${PKG_NAME}_${VERSION}.orig.tar.gz"

# 4. Inject debian/ packaging metadata for the target distribution series
echo "==> Configuring debian packaging metadata for ${SERIES}..."
cp -r "${SCRIPT_DIR}/debian" "${SOURCE_DIR}/"

# Update changelog distribution series and version header
UPSTREAM_VER="${VERSION}-1ubuntu1~${SERIES}"
sed -i.bak -E "1s/\([0-9]+\.[0-9]+\.[0-9]+(-[0-9]+[a-z0-9~]+)?\) [a-z]+;/\(${UPSTREAM_VER}\) ${SERIES};/" "${SOURCE_DIR}/debian/changelog"
rm -f "${SOURCE_DIR}/debian/changelog.bak"

# 5. Build Debian source package
echo "==> Building Debian source package..."
cd "${SOURCE_DIR}"

# Check for GPG key
if [[ -z "${GPG_KEY}" ]]; then
  # Detect full 40-char fingerprint from local secret keys
  DEFAULT_FPR="$(gpg --list-secret-keys --with-colons 2>/dev/null | awk -F: '$1 == "fpr" {print $10; exit}')"
  if [[ -n "${DEFAULT_FPR}" ]]; then
    GPG_KEY="${DEFAULT_FPR}"
    echo "==> Auto-detected local GPG key fingerprint: ${GPG_KEY}"
  fi
fi

BUILD_ARGS=(-S -sa -d -nc)
IS_SIGNED=false

# If running non-interactively without passphrase, avoid blocking or batch failures
PASS="${GPG_PASSPHRASE:-${LAUNCHPAD_GPG_PASSPHRASE:-}}"
if [[ -n "${GPG_KEY}" ]]; then
  if [[ -n "${PASS}" ]]; then
    # Automated headless signing with provided passphrase
    BUILD_ARGS+=("-k${GPG_KEY}")
    SIGN_WRAPPER="${BUILD_DIR}/gpg-sign-wrapper.sh"
    cat <<'EOF' > "${SIGN_WRAPPER}"
#!/usr/bin/env bash
P="${GPG_PASSPHRASE:-${LAUNCHPAD_GPG_PASSPHRASE:-}}"
exec gpg --batch --yes --no-tty --pinentry-mode loopback --passphrase "${P}" "$@"
EOF
    chmod +x "${SIGN_WRAPPER}"
    BUILD_ARGS+=("-p${SIGN_WRAPPER}")
    IS_SIGNED=true
  elif [[ "${NON_INTERACTIVE}" == "true" ]]; then
    echo "ℹ️ Non-interactive mode without passphrase: building unsigned source package (-us -uc)."
    echo "You can sign afterwards with: debsign -k${GPG_KEY} <changes_file>"
    BUILD_ARGS+=("-us" "-uc")
  else
    # Interactive local build: allow standard pinentry prompt
    BUILD_ARGS+=("-k${GPG_KEY}")
    IS_SIGNED=true
  fi
else
  echo "⚠️ Warning: No GPG key provided or detected. Building unsigned source package (-us -uc)."
  echo "Note: Launchpad requires signed packages. You can sign later via: debsign -k<KEYID> <changes_file>"
  BUILD_ARGS+=("-us" "-uc")
fi

if command -v debuild >/dev/null 2>&1; then
  echo "==> Executing debuild..."
  debuild "${BUILD_ARGS[@]}"
elif command -v dpkg-buildpackage >/dev/null 2>&1; then
  echo "==> 'debuild' not found, using 'dpkg-buildpackage' directly..."
  dpkg-buildpackage "${BUILD_ARGS[@]}" -d -nc
else
  echo "❌ Neither 'debuild' nor 'dpkg-buildpackage' found! Please install: sudo apt install -y devscripts debhelper"
  exit 1
fi

echo "==> Source package successfully built in ${BUILD_DIR}:"
ls -la "${BUILD_DIR}"/*.dsc "${BUILD_DIR}"/*_source.changes

CHANGES_FILE="$(ls -1 "${BUILD_DIR}"/*_source.changes | head -n1)"

echo ""
echo "=========================================================="
echo " Ready to upload to Launchpad!"
echo " Changes File: ${CHANGES_FILE}"
echo " PPA Target:   ${PPA_TARGET}"
echo "=========================================================="

if [[ "${IS_SIGNED}" != "true" ]]; then
  echo "⚠️ Package is currently unsigned. Launchpad will reject unsigned packages."
  echo "Sign before uploading using:"
  echo "   debsign -k<YOUR_GPG_KEY_ID> ${CHANGES_FILE}"
  echo "Or upload via GitHub Actions workflow with LAUNCHPAD_GPG_KEY configured."
fi

if command -v dput >/dev/null 2>&1; then
  if [[ "${IS_SIGNED}" == "true" ]]; then
    if [[ "${NON_INTERACTIVE}" == "true" ]]; then
      echo "==> Non-interactive mode: executing dput upload..."
      dput "${PPA_TARGET}" "${CHANGES_FILE}"
      echo "==> Successfully uploaded to ${PPA_TARGET}!"
      echo "Monitor build progress at: https://launchpad.net/~${PPA_TARGET#ppa:}"
    else
      read -p "Upload now with dput? (y/N) " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        dput "${PPA_TARGET}" "${CHANGES_FILE}"
        echo "==> Successfully uploaded to ${PPA_TARGET}!"
        echo "Monitor build progress at: https://launchpad.net/~${PPA_TARGET#ppa:}"
      fi
    fi
  fi
else
  echo "ℹ️ 'dput' is not installed locally. Run: sudo apt install dput"
  echo "Once installed and signed, upload by running:"
  echo "   dput ${PPA_TARGET} ${CHANGES_FILE}"
fi
