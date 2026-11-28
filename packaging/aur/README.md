# Arch Linux Pacman Repository & PKGBUILD Guide

This directory contains the `PKGBUILD`, `.SRCINFO`, and packaging documentation for **PatchCraft Launcher** targeting **Arch Linux**, **CachyOS**, **EndeavourOS**, **Manjaro**, **Garuda Linux**, and **SteamOS**.

## Official Signed Pacman Repository (Recommended)

PatchCraft Launcher provides a GPG-signed native Arch binary repository (`x86_64`) with automatic `sudo pacman -Syu` updates and no AUR helper required.

- **Repository Base URL:** `https://repo.patchcraft.dev/arch/$arch`
- **Signing Key:** `https://repo.patchcraft.dev/gpg.asc`
- **Verification:** Both `.pkg.tar.zst` packages and the `patchcraft.db` repository database are GPG-signed.

### Step 1: Import and Locally Sign the GPG Key

```bash
curl -fsSL https://repo.patchcraft.dev/gpg.asc -o /tmp/patchcraft.asc
sudo pacman-key --add /tmp/patchcraft.asc
sudo pacman-key --lsign-key "$(gpg --show-keys --with-colons /tmp/patchcraft.asc | awk -F: '$1=="fpr"{print $10; exit}')"
rm -f /tmp/patchcraft.asc
```

### Step 2: Register the `[patchcraft]` Repository and Install

```bash
grep -q '^\[patchcraft\]' /etc/pacman.conf || printf '\n[patchcraft]\nServer = https://repo.patchcraft.dev/arch/$arch\n' | sudo tee -a /etc/pacman.conf
sudo pacman -Syu patchcraft-launcher
```

Future releases upgrade automatically with `sudo pacman -Syu`.

## Alternative Install Methods

### Standalone `.pacman` Release Package

Download directly from [GitHub Releases](https://github.com/cook0001/Patchcraft-Launcher/releases) and install with `pacman -U`:

```bash
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/patchcraft-launcher-2.0.1.x64.pacman
sudo pacman -U ./patchcraft-launcher-2.0.1.x64.pacman
```

### Local Build with `PKGBUILD` and `makepkg`

```bash
cd packaging/aur
./build-aur-package.sh --install
```

### Steam Deck & SteamOS (Desktop Mode)

On SteamOS where the root filesystem is read-only by default, use the rootless turnkey installer:

```bash
curl -sSL https://launcher.patchcraft.dev/deck-install.sh | bash
```

## Runtime Dependencies

| Package | Purpose |
|:---|:---|
| `gtk3` | GTK 3 graphical display toolkit |
| `nss` | Network Security Services & TLS transport |
| `libxss` | X11 Screen Saver extension |
| `libxtst` | X11 Testing extension |
| `xdg-utils` | FreeDesktop URL handler & browser integration |
| `at-spi2-core` | Assistive technologies & accessibility bus |
| `libdrm` | Direct Rendering Manager |
| `mesa` | Mesa 3D graphics drivers (RADV, Iris, Zink) |
| `alsa-lib` | ALSA audio playback |
| `tar` & `xz` | Archive extraction for native RS3 client updates |

### Optional Dependencies (`optdepends`)
- `java-runtime`: Required for running RuneLite and HDOS.
- `gamemode`: Feral GameMode for CPU governor and process priority optimization.
- `mangohud`: Real-time hardware monitoring and FPS overlay.
