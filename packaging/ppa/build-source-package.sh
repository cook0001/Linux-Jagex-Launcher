#!/usr/bin/env bash
# ==============================================================================
# Linux Jagex Launcher - Launchpad PPA Source Package Builder & Uploader
# ==============================================================================
set -euo pipefail

PPA_TARGET=""
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
RAW_SERIES="${POSITIONAL_ARGS[1]:-noble}"

# Check for GPG key in positional arguments (e.g. if 3rd arg is provided and GPG_KEY not set via flag)
if [[ -z "${GPG_KEY}" && ${#POSITIONAL_ARGS[@]} -ge 3 ]]; then
  LAST_ARG="${POSITIONAL_ARGS[-1]}"
  if [[ "${LAST_ARG}" =~ ^[0-9A-Fa-f]{8,40}$ ]]; then
    GPG_KEY="${LAST_ARG}"
  fi
fi

# Supported default series for 'all'
DEFAULT_ALL_SERIES=("resolute" "noble" "jammy")

# Parse target distribution series
SERIES_LIST=()
if [[ "${RAW_SERIES}" == "all" ]]; then
  SERIES_LIST=("${DEFAULT_ALL_SERIES[@]}")
elif [[ "${RAW_SERIES}" == *","* ]]; then
  IFS=',' read -ra SERIES_LIST <<< "${RAW_SERIES}"
elif [[ "${RAW_SERIES}" == *" "* ]]; then
  read -ra SERIES_LIST <<< "${RAW_SERIES}"
else
  SERIES_LIST=("${RAW_SERIES}")
fi

# Also append any additional positional arguments that are series names (if GPG_KEY was already set)
if [[ ${#POSITIONAL_ARGS[@]} -gt 2 ]]; then
  for ((idx=2; idx<${#POSITIONAL_ARGS[@]}; idx++)); do
    candidate="${POSITIONAL_ARGS[idx]}"
    if [[ "${candidate}" != "${GPG_KEY}" ]]; then
      SERIES_LIST+=("${candidate}")
    fi
  done
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

VERSION="$(node -p "require('${REPO_ROOT}/package.json').version")"
PKG_NAME="linux-jagex-launcher"
BUILD_DIR="$(mktemp -d -t ppa-build-XXXXXX)"

echo "=========================================================="
echo " Packaging:   ${PKG_NAME} ${VERSION}"
echo " Series:      ${SERIES_LIST[*]}"
echo " PPA Target:  ${PPA_TARGET}"
echo " Workspace:   ${BUILD_DIR}"
echo "=========================================================="

# 1. Ensure Electron Linux distribution is compiled once for all series
UNPACKED_DIR="${REPO_ROOT}/release/linux-unpacked"
if [[ ! -d "${UNPACKED_DIR}" || ! -f "${UNPACKED_DIR}/linux-jagex-launcher" ]]; then
  echo "==> Building Electron Linux unpacked distribution..."
  (cd "${REPO_ROOT}" && npm run build && npx electron-builder --linux --dir)
fi

# 2. Prepare upstream source directory
SOURCE_DIR="${BUILD_DIR}/${PKG_NAME}-${VERSION}"
mkdir -p "${SOURCE_DIR}/usr/lib/linux-jagex-launcher"

echo "==> Staging application files and assets..."
cp -a "${UNPACKED_DIR}/." "${SOURCE_DIR}/usr/lib/linux-jagex-launcher/"

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

# Detect GPG key if not provided
if [[ -z "${GPG_KEY}" ]]; then
  DEFAULT_FPR="$(gpg --list-secret-keys --with-colons 2>/dev/null | awk -F: '$1 == "fpr" {print $10; exit}')"
  if [[ -n "${DEFAULT_FPR}" ]]; then
    GPG_KEY="${DEFAULT_FPR}"
    echo "==> Auto-detected local GPG key fingerprint: ${GPG_KEY}"
  fi
fi

PASS="${GPG_PASSPHRASE:-${LAUNCHPAD_GPG_PASSPHRASE:-}}"
SIGN_WRAPPER="${BUILD_DIR}/gpg-sign-wrapper.sh"
if [[ -n "${GPG_KEY}" && -n "${PASS}" ]]; then
  cat <<'EOF' > "${SIGN_WRAPPER}"
#!/usr/bin/env bash
P="${GPG_PASSPHRASE:-${LAUNCHPAD_GPG_PASSPHRASE:-}}"
exec gpg --batch --yes --no-tty --pinentry-mode loopback --passphrase "${P}" "$@"
EOF
  chmod +x "${SIGN_WRAPPER}"
fi

# 4. Loop across all target distribution series with 30s cooldown and automatic retry loop
TOTAL_SERIES=${#SERIES_LIST[@]}
for ((i=0; i<TOTAL_SERIES; i++)); do
  CURRENT_SERIES="${SERIES_LIST[i]}"

  # Apply 30-second cooldown between series
  if [[ "$i" -gt 0 ]]; then
    echo ""
    echo "=========================================================="
    echo " ⏱️  Cooling down 30s between series to prevent Launchpad FTP rate-limiting..."
    echo "=========================================================="
    sleep 30
  fi

  echo ""
  echo "=========================================================="
  echo " [${i+1}/${TOTAL_SERIES}] Building & Uploading for Ubuntu Series: ${CURRENT_SERIES}"
  echo "=========================================================="

  # Reset/inject clean debian packaging metadata
  rm -rf "${SOURCE_DIR}/debian"
  cp -r "${SCRIPT_DIR}/debian" "${SOURCE_DIR}/"

  # Update changelog distribution series and version header
  UPSTREAM_VER="${VERSION}-1ubuntu1~${CURRENT_SERIES}"
  sed -i.bak -E "1s/\([0-9]+\.[0-9]+\.[0-9]+(-[0-9]+[a-z0-9~]+)?\) [a-z]+;/\(${UPSTREAM_VER}\) ${CURRENT_SERIES};/" "${SOURCE_DIR}/debian/changelog"
  rm -f "${SOURCE_DIR}/debian/changelog.bak"

  # Clean any residual debian/files from previous builds
  rm -f "${SOURCE_DIR}/debian/files"

  # Build Debian source package
  echo "==> Building Debian source package for ${CURRENT_SERIES}..."
  cd "${SOURCE_DIR}"

  BUILD_ARGS=(-S -sa -d -nc)
  IS_SIGNED=false

  if [[ -n "${GPG_KEY}" ]]; then
    if [[ -n "${PASS}" ]]; then
      BUILD_ARGS+=("-k${GPG_KEY}" "-p${SIGN_WRAPPER}")
      IS_SIGNED=true
    elif [[ "${NON_INTERACTIVE}" == "true" ]]; then
      echo "ℹ️ Non-interactive mode without passphrase: building unsigned source package (-us -uc)."
      echo "You can sign afterwards with: debsign -k${GPG_KEY} <changes_file>"
      BUILD_ARGS+=("-us" "-uc")
    else
      BUILD_ARGS+=("-k${GPG_KEY}")
      IS_SIGNED=true
    fi
  else
    echo "⚠️ Warning: No GPG key provided or detected. Building unsigned source package (-us -uc)."
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

  CHANGES_FILE="${BUILD_DIR}/${PKG_NAME}_${UPSTREAM_VER}_source.changes"
  if [[ ! -f "${CHANGES_FILE}" ]]; then
    CHANGES_FILE="$(ls -1 "${BUILD_DIR}"/*"${CURRENT_SERIES}"*_source.changes 2>/dev/null | head -n1 || true)"
  fi

  if [[ -z "${CHANGES_FILE}" || ! -f "${CHANGES_FILE}" ]]; then
    echo "❌ Failed to locate .changes file for ${CURRENT_SERIES} in ${BUILD_DIR}!"
    exit 1
  fi

  echo "==> Source package successfully built in ${BUILD_DIR}:"
  ls -la "${CHANGES_FILE}"

  if [[ "${IS_SIGNED}" != "true" ]]; then
    echo "⚠️ Package is currently unsigned. Launchpad will reject unsigned packages."
    echo "Sign before uploading using:"
    echo "   debsign -k<YOUR_GPG_KEY_ID> ${CHANGES_FILE}"
    echo "Or upload via GitHub Actions workflow with LAUNCHPAD_GPG_KEY configured."
  fi

  # Upload with Automatic Retry Loop (30s cooldown between attempts)
  if command -v dput >/dev/null 2>&1; then
    if [[ "${IS_SIGNED}" == "true" ]]; then
      UPLOAD_CMD=(dput "${PPA_TARGET}" "${CHANGES_FILE}")
      DO_UPLOAD=false

      if [[ "${NON_INTERACTIVE}" == "true" ]]; then
        DO_UPLOAD=true
      else
        read -p "Upload ${CURRENT_SERIES} now with dput? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
          DO_UPLOAD=true
        fi
      fi

      if [[ "${DO_UPLOAD}" == "true" ]]; then
        echo "==> Initiating dput upload with automatic retry loop..."
        MAX_RETRIES=4
        RETRY_DELAY=30
        UPLOADED=false

        for ((attempt=1; attempt<=MAX_RETRIES; attempt++)); do
          echo "==> Executing dput upload for ${CURRENT_SERIES} (attempt ${attempt}/${MAX_RETRIES})..."
          set +e
          "${UPLOAD_CMD[@]}"
          UPLOAD_EXIT=$?
          set -e

          if [[ ${UPLOAD_EXIT} -eq 0 ]]; then
            UPLOADED=true
            echo "==> Successfully uploaded ${CURRENT_SERIES} to ${PPA_TARGET}!"
            echo "Monitor build progress at: https://launchpad.net/~${PPA_TARGET#ppa:}"
            break
          elif [[ ${attempt} -lt ${MAX_RETRIES} ]]; then
            echo "⚠️ dput upload failed with exit code ${UPLOAD_EXIT} (attempt ${attempt}/${MAX_RETRIES})."
            echo "Launchpad FTP servers frequently encounter transient connection drops or rate-limiting."
            echo "Waiting ${RETRY_DELAY}s before retrying attempt $((attempt + 1))..."
            sleep "${RETRY_DELAY}"
          fi
        done

        if [[ "${UPLOADED}" != "true" ]]; then
          echo "❌ dput upload for ${CURRENT_SERIES} failed after ${MAX_RETRIES} attempts."
          exit 1
        fi
      fi
    fi
  else
    echo "ℹ️ 'dput' is not installed locally. Run: sudo apt install dput"
    echo "Once installed and signed, upload by running:"
    echo "   dput ${PPA_TARGET} ${CHANGES_FILE}"
  fi
done

echo ""
echo "=========================================================="
echo " ✅ PPA Source Packaging Complete!"
echo " Series processed: ${SERIES_LIST[*]}"
echo " Workspace:        ${BUILD_DIR}"
echo "=========================================================="
