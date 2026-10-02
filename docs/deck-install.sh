#!/usr/bin/env bash
set -e

# ==============================================================================
# Linux Jagex Launcher - Steam Deck & SteamOS Fast Automated Installer
# Works 100% rootless in userspace. Never touches read-only system partitions.
# ==============================================================================

REPO="cook0001/Linux-Jagex-Launcher"
APP_NAME="Jagex Launcher"
APPLICATIONS_DIR="${HOME}/Applications"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICONS_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"
LAUNCHER_DATA_DIR="${HOME}/.local/share/linux-jagex-launcher"

echo "=================================================="
echo "   🎮 Linux Jagex Launcher - Steam Deck Setup     "
echo "=================================================="

# Check architecture
ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ]; then
  echo "❌ Error: Only x86_64 (amd64) devices are supported."
  exit 1
fi

echo "🔍 Finding Steam user profile..."
STEAM_DIR=""
if [ -d "${HOME}/.steam/steam/userdata" ]; then
  STEAM_DIR="${HOME}/.steam/steam"
elif [ -d "${HOME}/.local/share/Steam/userdata" ]; then
  STEAM_DIR="${HOME}/.local/share/Steam"
fi

if [ -n "$STEAM_DIR" ]; then
  echo "✓ Found Steam directory: ${STEAM_DIR}"
else
  echo "⚠️ Warning: Steam userdata directory not found. Please launch Steam once."
fi

# Ensure required directories exist
mkdir -p "${APPLICATIONS_DIR}"
mkdir -p "${DESKTOP_DIR}"
mkdir -p "${ICONS_DIR}"
mkdir -p "${LAUNCHER_DATA_DIR}/grid"

echo "🔍 Checking latest release from GitHub..."
LATEST_TAG=$(curl -sSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
if [ -z "$LATEST_TAG" ]; then
  LATEST_TAG="v1.4.4"
fi
VERSION="${LATEST_TAG#v}"

TARGET_APPIMAGE="${APPLICATIONS_DIR}/Jagex-Launcher.AppImage"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/Jagex-Launcher-${VERSION}.AppImage"

echo "📥 Downloading Jagex Launcher ${LATEST_TAG} to ~/Applications/..."
curl -L -o "${TARGET_APPIMAGE}.part" "${DOWNLOAD_URL}"
mv "${TARGET_APPIMAGE}.part" "${TARGET_APPIMAGE}"
chmod 0755 "${TARGET_APPIMAGE}"
echo "✓ Installed executable: ${TARGET_APPIMAGE}"

echo "🎨 Fetching Steam Deck artwork and icons..."
ICON_URL="https://raw.githubusercontent.com/${REPO}/main/docs/assets/icon.png"
HERO_URL="https://raw.githubusercontent.com/${REPO}/main/docs/assets/banner.png"

curl -sSL -o "${ICONS_DIR}/io.github.cook0001.LinuxJagexLauncher.png" "${ICON_URL}"
curl -sSL -o "${LAUNCHER_DATA_DIR}/icon.png" "${ICON_URL}"
curl -sSL -o "${LAUNCHER_DATA_DIR}/banner.png" "${HERO_URL}"

# Create standard .desktop file
DESKTOP_FILE="${DESKTOP_DIR}/io.github.cook0001.LinuxJagexLauncher.desktop"
cat <<EOF > "${DESKTOP_FILE}"
[Desktop Entry]
Name=${APP_NAME}
Comment=Authentic Linux Jagex Launcher for RuneScape 3, Old School RuneScape, and Dragonwilds
Exec="${TARGET_APPIMAGE}" %U
Icon=${ICONS_DIR}/io.github.cook0001.LinuxJagexLauncher.png
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=linux-jagex-launcher
MimeType=x-scheme-handler/jagex;x-scheme-handler/jagex-launcher;
PrefersNonDefaultGPU=true
X-KDE-SubstituteUID=false
EOF
chmod 0755 "${DESKTOP_FILE}"
echo "✓ Created desktop application entry: ${DESKTOP_FILE}"

# Add to Steam shortcuts and grid configuration if Steam directory is available
if [ -n "$STEAM_DIR" ] && [ -d "${STEAM_DIR}/userdata" ]; then
  echo "🔗 Registering Non-Steam Game shortcut and artwork..."

  # Compute Steam non-Steam AppID via python or perl if available
  APPID=""
  if command -v python3 >/dev/null 2>&1; then
    APPID=$(python3 -c "import binascii; print((binascii.crc32(b'\"${TARGET_APPIMAGE}\"${APP_NAME}') | 0x80000000) & 0xFFFFFFFF)")
  elif command -v perl >/dev/null 2>&1; then
    APPID=$(perl -e 'use String::CRC32; print((crc32("\"'${TARGET_APPIMAGE}'\"'${APP_NAME}'") | 0x80000000) & 0xFFFFFFFF);' 2>/dev/null || echo "")
  fi

  for USER_DIR in "${STEAM_DIR}/userdata/"*; do
    if [ -d "$USER_DIR" ] && [ "$(basename "$USER_DIR")" != "0" ] && [[ "$(basename "$USER_DIR")" =~ ^[0-9]+$ ]]; then
      CONFIG_DIR="${USER_DIR}/config"
      GRID_DIR="${CONFIG_DIR}/grid"
      SHORTCUTS_FILE="${CONFIG_DIR}/shortcuts.vdf"
      mkdir -p "${GRID_DIR}"

      # 1. Place Steam Grid high-res artwork
      if [ -n "$APPID" ]; then
        cp "${LAUNCHER_DATA_DIR}/icon.png" "${GRID_DIR}/${APPID}.png" 2>/dev/null || true
        cp "${LAUNCHER_DATA_DIR}/banner.png" "${GRID_DIR}/${APPID}p.png" 2>/dev/null || true
        cp "${LAUNCHER_DATA_DIR}/banner.png" "${GRID_DIR}/${APPID}_hero.png" 2>/dev/null || true
        cp "${LAUNCHER_DATA_DIR}/icon.png" "${GRID_DIR}/${APPID}_logo.png" 2>/dev/null || true
      fi

      # 2. Automatically register shortcut in shortcuts.vdf via python3 if available
      if command -v python3 >/dev/null 2>&1; then
        python3 -c "
import os, sys, struct, binascii

app_name = sys.argv[1]
exe = sys.argv[2]
start_dir = sys.argv[3]
icon = sys.argv[4]
shortcuts_file = sys.argv[5]

app_id = (binascii.crc32(f'\"{exe}\"{app_name}'.encode()) | 0x80000000) & 0xFFFFFFFF

chunk = b'\x000\x00'
chunk += b'\x02appid\x00' + struct.pack('<I', app_id)
chunk += b'\x01AppName\x00' + app_name.encode() + b'\x00'
chunk += b'\x01Exe\x00\"' + exe.encode() + b'\"\x00'
chunk += b'\x01StartDir\x00\"' + start_dir.encode() + b'\"\x00'
chunk += b'\x01icon\x00' + icon.encode() + b'\x00'
chunk += b'\x01LaunchOptions\x00GDK_BACKEND=x11 SDL_VIDEODRIVER=x11 %command%\x00'
chunk += b'\x02IsHidden\x00\x00\x00\x00\x00'
chunk += b'\x02AllowDesktopConfig\x00\x01\x00\x00\x00'
chunk += b'\x02AllowOverlay\x00\x01\x00\x00\x00'
chunk += b'\x02OpenVR\x00\x00\x00\x00\x00'
chunk += b'\x02Devkit\x00\x00\x00\x00\x00'
chunk += b'\x01DevkitGameID\x00\x00'
chunk += b'\x02DevkitOverrideAppID\x00\x00\x00\x00\x00'
chunk += b'\x02LastPlayTime\x00\x00\x00\x00\x00'
chunk += b'\x01FlatpakAppID\x00\x00'
chunk += b'\x00tags\x00\x08'
chunk += b'\x08'

try:
    if not os.path.exists(shortcuts_file) or os.path.getsize(shortcuts_file) < 10:
        with open(shortcuts_file, 'wb') as f:
            f.write(b'\x00shortcuts\x00' + chunk + b'\x08\x08')
    else:
        with open(shortcuts_file, 'rb') as f:
            data = f.read()
        if app_name.encode() not in data:
            insert_pos = len(data) - 2
            for i in range(len(data) - 1, 0, -1):
                if data[i] == 0x08 and data[i-1] == 0x08:
                    insert_pos = i - 1
                    break
            new_data = data[:insert_pos] + chunk + b'\x08\x08'
            with open(shortcuts_file, 'wb') as f:
                f.write(new_data)
except Exception as err:
    pass
" "${APP_NAME}" "${TARGET_APPIMAGE}" "${APPLICATIONS_DIR}" "${LAUNCHER_DATA_DIR}/icon.png" "${SHORTCUTS_FILE}" 2>/dev/null || true
      fi
    fi
  done
  echo "✓ Added to Steam shortcuts.vdf and placed custom artwork in Steam Grid configuration."
fi

# Send desktop notification if available
if command -v notify-send >/dev/null 2>&1; then
  notify-send -i "${ICONS_DIR}/io.github.cook0001.LinuxJagexLauncher.png" "Jagex Launcher Installed" "Ready to play! Return to Gaming Mode to launch." 2>/dev/null || true
fi

echo ""
echo "=================================================="
echo "🎉 Setup complete! You're ready to play on Steam Deck:"
echo " 1. Return to Gaming Mode (double-click 'Return to Gaming Mode' on desktop)"
echo " 2. Find '${APP_NAME}' in your Library under 'Non-Steam'"
echo " 3. Launch and enjoy native RuneScape on Steam Deck!"
echo "=================================================="
