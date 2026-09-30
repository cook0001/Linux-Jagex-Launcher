#!/usr/bin/env bash
set -e

# Linux Jagex Launcher - One-Line Installer for Debian / Ubuntu / Mint / Pop!_OS
REPO="cook0001/Linux-Jagex-Launcher"
echo "=================================================="
echo "    Linux Jagex Launcher - Official Installer     "
echo "=================================================="

# Check architecture
ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ]; then
  echo "❌ Error: Only x86_64 (amd64) Linux is currently supported."
  exit 1
fi

# Detect package manager
if ! command -v apt-get >/dev/null 2>&1; then
  echo "⚠️ Warning: apt-get not found. This installer is intended for Debian/Ubuntu-based distributions."
  echo "Please download the universal AppImage or install from AUR:"
  echo "https://github.com/${REPO}/releases/latest"
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "🔍 Fetching latest release information..."
LATEST_TAG=$(curl -sSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_TAG" ]; then
  LATEST_TAG="v1.4.1"
fi

VERSION="${LATEST_TAG#v}"
DEB_NAME="jagex-launcher_${VERSION}_amd64.deb"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${DEB_NAME}"

echo "📥 Downloading ${DEB_NAME} (${LATEST_TAG})..."
curl -sSL -o "${TMP_DIR}/${DEB_NAME}" "$DOWNLOAD_URL"

echo "📦 Installing package and dependencies with apt..."
sudo apt-get update
sudo apt-get install -y "${TMP_DIR}/${DEB_NAME}"

echo ""
echo "✅ Installation complete!"
echo "You can launch the application from your desktop menu or by running:"
echo "   jagex-launcher"
echo "=================================================="
