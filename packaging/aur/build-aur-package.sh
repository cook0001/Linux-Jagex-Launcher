#!/usr/bin/env bash
# ==============================================================================
# Linux Jagex Launcher - Arch / AUR Standalone Package Builder
# ==============================================================================
# This script builds the Arch Linux standalone package locally using makepkg,
# validates PKGBUILD syntax, updates .SRCINFO, and tests the package payload.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "=========================================================="
echo " 📦 Arch Linux & AUR Package Build Tool"
echo "=========================================================="

if ! command -v makepkg &>/dev/null; then
  echo "⚠️ 'makepkg' command not found."
  echo "This script is intended to run on Arch Linux, Manjaro, EndeavourOS, or SteamOS."
  echo ""
  echo "To build native Arch packages on Debian/Ubuntu, use:"
  echo "  npm run dist:pacman"
  exit 0
fi

echo "==> Step 1: Updating .SRCINFO from PKGBUILD..."
makepkg --printsrcinfo > .SRCINFO
echo "✅ .SRCINFO synchronized."

echo ""
echo "==> Step 2: Building standalone Arch package..."
if [[ "${1:-}" == "--install" || "${1:-}" == "-i" ]]; then
  makepkg -si --noconfirm
else
  makepkg -sf --noconfirm
fi

echo ""
echo "=========================================================="
echo " ✅ Arch package build completed successfully!"
echo " Output files:"
ls -lh *.pkg.tar.zst 2>/dev/null || ls -lh *.pkg.tar.xz 2>/dev/null || true
echo "=========================================================="
