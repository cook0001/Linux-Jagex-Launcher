#!/usr/bin/env bash
set -e

# Linux Jagex Launcher - Installer for Debian / Ubuntu / Mint / Pop!_OS
REPO="cook0001/Linux-Jagex-Launcher"
APT_ETC_DIR="${APT_ETC_DIR:-/etc/apt}"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

# Detects and safely disables Jagex's deprecated Ubuntu 14.04 (trusty) APT repository
# (https://content.runescape.com/downloads/ubuntu), which fails OpenPGP verification on
# Ubuntu 24.04+ and Ubuntu 26.04 ("Resolute Raccoon") with NO_PUBKEY 7373B12CE03BEB4B /
# "The repository ... trusty InRelease is not signed" and blocks apt-get update.
cleanup_legacy_jagex_apt() {
  local removable_files=()
  local shared_list_files=()
  local shared_deb822_files=()
  local main_list="${APT_ETC_DIR}/sources.list"
  local list_dir="${APT_ETC_DIR}/sources.list.d"

  if [ -f "$main_list" ]; then
    local main_jagex_count
    main_jagex_count=$(grep -Ev '^[[:space:]]*(#|$)' "$main_list" | grep -Eic 'content\.runescape\.com/downloads/ubuntu' || true)
    if [ "$main_jagex_count" -gt 0 ]; then
      shared_list_files+=("$main_list")
    fi
  fi

  if [ -d "$list_dir" ]; then
    local f
    for f in "$list_dir"/*.list; do
      [ -f "$f" ] || continue
      local total_active jagex_active
      total_active=$(grep -Evc '^[[:space:]]*(#|$)' "$f" || true)
      jagex_active=$(grep -Ev '^[[:space:]]*(#|$)' "$f" | grep -Eic 'content\.runescape\.com/downloads/ubuntu' || true)
      if [ "$jagex_active" -gt 0 ]; then
        if [ "$jagex_active" -eq "$total_active" ]; then
          removable_files+=("$f")
        else
          shared_list_files+=("$f")
        fi
      fi
    done

    for f in "$list_dir"/*.sources; do
      [ -f "$f" ] || continue
      local jagex_uris other_uris disabled_flag
      disabled_flag=$(grep -Eic '^[[:space:]]*Enabled:[[:space:]]*(no|false|0)[[:space:]]*$' "$f" || true)
      jagex_uris=$(grep -Ev '^[[:space:]]*(#|$)' "$f" | grep -Eic 'content\.runescape\.com/downloads/ubuntu' || true)
      if [ "$jagex_uris" -gt 0 ] && [ "$disabled_flag" -eq 0 ]; then
        other_uris=$(grep -Ei '^[[:space:]]*URIs:' "$f" | grep -Evic 'content\.runescape\.com/downloads/ubuntu' || true)
        if [ "$other_uris" -eq 0 ]; then
          removable_files+=("$f")
        else
          shared_deb822_files+=("$f")
        fi
      fi
    done
  fi

  if [ "${#removable_files[@]}" -eq 0 ] && [ "${#shared_list_files[@]}" -eq 0 ] && [ "${#shared_deb822_files[@]}" -eq 0 ]; then
    return 0
  fi

  echo "--> Detected Jagex's deprecated Ubuntu 14.04 (trusty) APT repository:"
  echo "    https://content.runescape.com/downloads/ubuntu"
  echo "    This unmaintained repository fails OpenPGP verification on modern Ubuntu"
  echo "    (NO_PUBKEY 7373B12CE03BEB4B / InRelease is not signed) and is not needed"
  echo "    because Linux Jagex Launcher extracts the RS3 client rootlessly in userspace."
  echo "--> Removing deprecated Jagex APT source entry..."

  local key_candidates=(
    "${APT_ETC_DIR}/trusted.gpg.d/runescape.gpg"
    "${APT_ETC_DIR}/trusted.gpg.d/runescape.asc"
  )
  if [ "$APT_ETC_DIR" = "/etc/apt" ]; then
    key_candidates+=(
      "/usr/share/keyrings/runescape.gpg"
      "/usr/share/keyrings/runescape.asc"
      "/etc/apt/keyrings/runescape.gpg"
      "/etc/apt/keyrings/runescape.asc"
    )
  fi
  local kf
  for kf in "${key_candidates[@]}"; do
    if [ -f "$kf" ]; then
      removable_files+=("$kf")
    fi
  done

  if [ "${#removable_files[@]}" -gt 0 ]; then
    $SUDO rm -f -- "${removable_files[@]}"
  fi

  local sf
  for sf in "${shared_list_files[@]}"; do
    $SUDO sed -i.bak '/content\.runescape\.com\/downloads\/ubuntu/s/^[[:space:]]*deb/# disabled legacy jagex repo: deb/' "$sf"
  done

  for sf in "${shared_deb822_files[@]}"; do
    $SUDO sed -i.bak '/content\.runescape\.com\/downloads\/ubuntu/s|^|# disabled legacy jagex repo: |' "$sf"
  done
}

main() {
  echo "==> Linux Jagex Launcher Installer"

  # Check architecture
  ARCH=$(uname -m)
  if [ "$ARCH" != "x86_64" ]; then
    echo "Error: Only x86_64 (amd64) Linux is currently supported." >&2
    exit 1
  fi

  # Detect package manager
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Warning: apt-get not found. This installer is intended for Debian/Ubuntu-based distributions." >&2
    echo "Please download the universal AppImage or install from AUR:"
    echo "https://github.com/${REPO}/releases/latest"
    exit 1
  fi

  TMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TMP_DIR"' EXIT

  echo "--> Fetching latest release information..."
  LATEST_TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' || true)

  if [ -z "$LATEST_TAG" ]; then
    LATEST_TAG="v1.4.8"
  fi

  VERSION="${LATEST_TAG#v}"
  DEB_NAME="jagex-launcher_${VERSION}_amd64.deb"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${DEB_NAME}"

  echo "--> Downloading ${DEB_NAME} (${LATEST_TAG})..."
  curl -fsSL -o "${TMP_DIR}/${DEB_NAME}" "$DOWNLOAD_URL"

  cleanup_legacy_jagex_apt

  echo "--> Installing package and dependencies with apt..."
  if ! $SUDO apt-get update; then
    echo "Warning: 'apt-get update' reported errors from another third-party repository; continuing with local .deb installation..." >&2
  fi
  $SUDO apt-get install -y "${TMP_DIR}/${DEB_NAME}"

  echo ""
  echo "Installation complete!"
  echo "Launch the application from your application launcher or by running: jagex-launcher"
}

if [ "${JAGEX_INSTALLER_SOURCE_ONLY:-0}" != "1" ]; then
  main "$@"
fi
