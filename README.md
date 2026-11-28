# PatchCraft Launcher

Unofficial native Linux and SteamOS launcher for RuneScape 3, Old School RuneScape, and RuneScape: Dragonwilds with Jagex Account sign-in.

[![Latest Release](https://img.shields.io/github/v/release/cook0001/Patchcraft-Launcher?color=d8a445)](https://github.com/cook0001/Patchcraft-Launcher/releases)
[![patchcraft-launcher](https://snapcraft.io/patchcraft-launcher/badge.svg)](https://snapcraft.io/patchcraft-launcher)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-6c7685.svg)](LICENSE)
[![Website](https://img.shields.io/badge/Website-launcher.patchcraft.dev-2b3340.svg)](https://launcher.patchcraft.dev/)

![PatchCraft Launcher showing RuneScape 3 on Linux](docs/assets/screenshot-rs3.png)

PatchCraft Launcher (formerly *Linux Jagex Launcher*) runs Jagex's native 64-bit Linux RuneScape 3 client, Old School RuneScape clients (RuneLite, HDOS, or Official), and Dragonwilds via Steam from a single desktop window without Wine or Proton. It signs in directly against `account.jagex.com` using OAuth 2.0 PKCE and stores settings locally in `~/.config/patchcraft-launcher/`.

> Packages use the `patchcraft-launcher` slug while preserving legacy `linux-jagex-launcher` CLI symlinks. Not affiliated with Jagex Ltd.

## Installation

### Ubuntu, Linux Mint, and Pop!_OS (Launchpad PPA)

Supports Ubuntu 26.04, 24.04, and 22.04 LTS with updates through `apt`:

```bash
sudo add-apt-repository ppa:danielcook2016/patchcraft-launcher
sudo apt update
sudo apt install -y patchcraft-launcher
```

Or install the standalone `.deb` from [Releases](https://github.com/cook0001/Patchcraft-Launcher/releases):

```bash
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/patchcraft-launcher_2.0.1_amd64.deb
sudo apt install ./patchcraft-launcher_2.0.1_amd64.deb
```

### Fedora, Nobara, RHEL, and openSUSE (Signed RPM Repo)

```bash
sudo curl -fsSL https://repo.patchcraft.dev/rpm/patchcraft.repo -o /etc/yum.repos.d/patchcraft.repo
sudo dnf install -y patchcraft-launcher
```

On openSUSE:

```bash
sudo zypper ar -f https://repo.patchcraft.dev/rpm/patchcraft.repo
sudo zypper refresh && sudo zypper install -y patchcraft-launcher
```

### Arch Linux, CachyOS, EndeavourOS, and Manjaro (Signed Pacman Repo)

Import the signing key, register the `[patchcraft]` repo, and install:

```bash
curl -fsSL https://repo.patchcraft.dev/gpg.asc -o /tmp/patchcraft.asc
sudo pacman-key --add /tmp/patchcraft.asc
sudo pacman-key --lsign-key "$(gpg --show-keys --with-colons /tmp/patchcraft.asc | awk -F: '$1=="fpr"{print $10; exit}')"
rm -f /tmp/patchcraft.asc

grep -q '^\[patchcraft\]' /etc/pacman.conf || printf '\n[patchcraft]\nServer = https://repo.patchcraft.dev/arch/$arch\n' | sudo tee -a /etc/pacman.conf
sudo pacman -Syu patchcraft-launcher
```

### Flatpak (PatchCraft Flatpak Repository)

Works across Linux desktops and SteamOS with automatic `flatpak update` support and bundled OpenSSL 1.1 / Java 21 runtimes:

```bash
flatpak install --user https://repo.patchcraft.dev/flatpak/patchcraft.flatpakref
flatpak run dev.patchcraft.Launcher
```

### Snap Store

[![Get it from the Snap Store](https://snapcraft.io/en/dark/install.svg)](https://snapcraft.io/patchcraft-launcher)

```bash
sudo snap install patchcraft-launcher

# Optional plugs for gamepads and external storage
sudo snap connect patchcraft-launcher:joystick
sudo snap connect patchcraft-launcher:removable-media
```

### Steam Deck / SteamOS

In Desktop Mode, open Konsole and run the userspace installer (does not disable `steamos-readonly`, registers a Non-Steam shortcut):

```bash
curl -sSL https://launcher.patchcraft.dev/deck-install.sh | bash
```

### AppImage and Portable Tarball

```bash
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/PatchCraft-Launcher-2.0.1.AppImage
chmod +x PatchCraft-Launcher-2.0.1.AppImage
./PatchCraft-Launcher-2.0.1.AppImage
```

Tarball with SHA-256 verification:

```bash
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/patchcraft-launcher-2.0.1.tar.gz
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/SHA256SUMS.txt
sha256sum -c SHA256SUMS.txt --ignore-missing
tar -xzf patchcraft-launcher-2.0.1.tar.gz
./patchcraft-launcher-2.0.1/patchcraft-launcher
```

## What It Includes

- **RuneScape 3:** Unpacks Jagex's native 64-bit Linux NXT client into userspace without `sudo`, provisions isolated OpenSSL 1.1 compatibility libraries on Ubuntu 22.04/24.04/26.04 and newer distros, and applies Wayland/audio startup fixes.
- **Old School RuneScape:** Launches RuneLite, HDOS, or the Official client with Jagex Account session handoff while keeping your existing `~/.runelite` directory intact.
- **RuneScape: Dragonwilds:** Launches through Steam (`steam://run/1374490`) with live Steam patch notes.
- **Diagnostics & Tools:** Built-in RS3/OSRS compatibility doctor, live client log viewer, parallel TCP world ping tool, Feral GameMode / MangoHud toggles, and optional close-on-launch or system tray behavior.
- **Steam Deck & Gamepads:** Full HTML5 Gamepad navigation, 1280x800 layout scaling, and Steam virtual keyboard support.

## Troubleshooting

- **`NO_PUBKEY 7373B12CE03BEB4B` or unsigned `trusty InRelease` on Ubuntu 24.04 / 26.04:** Leftover files from Jagex's deprecated Ubuntu 14.04 APT instructions break `apt update`. PatchCraft Launcher does not use that repo; remove it with:
  ```bash
  sudo rm -f /etc/apt/sources.list.d/runescape.list /etc/apt/sources.list.d/runescape.sources && sudo apt update
  ```
- **Missing `libssl1.1` on modern distros:** Do not force-install Ubuntu 20.04 `libssl1.1` packages into your host OS. PatchCraft Launcher isolates OpenSSL 1.1 in userspace for the RS3 client process only.
- **AppImage fails to start on Ubuntu 24.04+ or Fedora:** Install FUSE 2 (`sudo apt install libfuse2t64` or `sudo dnf install fuse-libs`), or use the PPA / RPM / Flatpak package instead.
- **Do not run with `sudo`:** Running as root writes root-owned files under `~/.config` and `~/.local/share`, breaking subsequent normal-user launches.

## Feedback & Issues

Report bugs or request features on [GitHub Issues](https://github.com/cook0001/Patchcraft-Launcher/issues) or [GitHub Discussions](https://github.com/cook0001/Patchcraft-Launcher/discussions) (or use **Community → Report Issue** inside the app).

PatchCraft Launcher is free with no paywalls. Optional hosting tips are welcome on [Ko-fi](https://ko-fi.com/patchcraft). See [PRIVACY.md](PRIVACY.md) for local data handling details.

## License

Proprietary software — see [LICENSE](LICENSE) for full terms.

*RuneScape*, *Old School RuneScape*, and *Jagex* are registered trademarks of Jagex Limited. PatchCraft Launcher is an independent, unofficial project and is not affiliated with or endorsed by Jagex Limited.
