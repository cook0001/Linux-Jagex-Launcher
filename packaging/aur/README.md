# 📦 Arch Linux & AUR Packaging Guide

This directory contains the packaging specifications and build configuration for **Linux Jagex Launcher** (`linux-jagex-launcher-bin`) targeting **Arch Linux**, **Manjaro**, **EndeavourOS**, **Garuda Linux**, **CachyOS**, and **SteamOS (Steam Deck)**.

---

## 📑 Table of Contents

1. [Distribution Methods](#1-distribution-methods)
2. [Building Standalone Packages Locally](#2-building-standalone-packages-locally)
3. [Publishing to the Arch User Repository (AUR)](#3-publishing-to-the-arch-user-repository-aur)
4. [Automated CI/CD Deployment](#4-automated-cicd-deployment)
5. [User Installation Instructions](#5-user-installation-instructions)
6. [Runtime Dependencies & Hardware Acceleration](#6-runtime-dependencies--hardware-acceleration)

---

## 1. Distribution Methods

Linux Jagex Launcher provides two native distribution methods for Arch-based distributions:

1. **Direct Standalone Pacman Package (`.pacman` / `.pkg.tar.zst`):**
   - Built directly via Electron Builder (`npm run dist:pacman`) or GitHub Actions CI.
   - Hosted on [GitHub Releases](https://github.com/cook0001/Linux-Jagex-Launcher/releases).
   - Installable directly using `sudo pacman -U <file>` without needing an AUR helper or build environment.

2. **Official Arch User Repository (`linux-jagex-launcher-bin`):**
   - Hosted on [AUR](https://aur.archlinux.org/packages/linux-jagex-launcher-bin).
   - Synchronized automatically via GitHub Actions workflow [`.github/workflows/aur.yml`](../../.github/workflows/aur.yml) on release.
   - Installable via any standard AUR helper (`yay`, `paru`).

---

## 2. Building Standalone Packages Locally

### Method A: Native Electron Builder (`dist:pacman`)
From the root of the repository, build the standalone pacman package:

```bash
npm run dist:pacman
```

The resulting package will be placed in `release/`:
```
release/linux-jagex-launcher-1.4.4.x86_64.pacman
```

### Method B: Standalone Build with `makepkg` (Arch / SteamOS)
If you are running on Arch Linux or SteamOS with `base-devel`:

```bash
cd packaging/aur
./build-aur-package.sh
```

To build and install immediately in one step:
```bash
./build-aur-package.sh --install
```

---

## 3. Publishing to the Arch User Repository (AUR)

### Step 1: Register and Configure SSH
1. Register an account on [https://aur.archlinux.org/](https://aur.archlinux.org/).
2. Upload your SSH public key in your AUR account settings.

### Step 2: Clone AUR Git Repository
```bash
git clone ssh://aur@aur.archlinux.org/linux-jagex-launcher-bin.git
cd linux-jagex-launcher-bin
```

### Step 3: Copy Packaging Files & Update Checksums
```bash
# Copy PKGBUILD and .SRCINFO from this repository
cp /path/to/packaging/aur/PKGBUILD .
cp /path/to/packaging/aur/.SRCINFO .

# (Optional) Verify checksums match the upstream release artifact:
updpkgsums
makepkg --printsrcinfo > .SRCINFO
```

### Step 4: Test Build Locally
```bash
makepkg -si
```

### Step 5: Commit and Push to AUR
```bash
git add PKGBUILD .SRCINFO
git commit -m "Release v1.4.4: Version sync across all package formats"
git push origin master
```

---

## 4. Automated CI/CD Deployment

The repository includes automated GitHub Actions deployment for AUR:

- **Workflow:** [`.github/workflows/aur.yml`](../../.github/workflows/aur.yml)
- **Repository Secret:** `AUR_SSH_PRIVATE_KEY`
- When you create a GitHub Release or dispatch the workflow, GitHub Actions automatically deploys the updated `PKGBUILD` and `.SRCINFO` to `ssh://aur@aur.archlinux.org/linux-jagex-launcher-bin.git`.

---

## 5. User Installation Instructions

### Option 1: Standalone Package (Pacman Direct Install)

Users without an AUR helper can download the standalone package directly from [GitHub Releases](https://github.com/cook0001/Linux-Jagex-Launcher/releases):

```bash
# 1. Download the latest standalone package:
curl -LO https://github.com/cook0001/Linux-Jagex-Launcher/releases/latest/download/linux-jagex-launcher-1.4.4.x86_64.pacman

# 2. Install with Pacman (resolves required dependencies automatically):
sudo pacman -U ./linux-jagex-launcher-1.4.4.x86_64.pacman

# 3. Launch:
linux-jagex-launcher
```

### Option 2: Install via AUR Helper

```bash
# Using yay:
yay -S linux-jagex-launcher-bin

# Using paru:
paru -S linux-jagex-launcher-bin
```

### Option 3: Steam Deck & SteamOS (Desktop Mode)

On SteamOS Desktop Mode:
```bash
# Install via yay or paru if unlocked, or run the turnkey installer:
curl -sSL https://cook0001.github.io/Linux-Jagex-Launcher/deck-install.sh | bash
```

---

## 6. Runtime Dependencies & Hardware Acceleration

The package automatically resolves the following runtime dependencies:

| Package | Purpose |
|:---|:---|
| `gtk3` | GTK+ 3 graphical display toolkit |
| `nss` | Network Security Services & TLS transport |
| `libxss` | X11 Screen Saver extension |
| `libxtst` | X11 Testing extension |
| `xdg-utils` | FreeDesktop URL handler & browser integration |
| `at-spi2-core` | Assistive technologies & accessibility bus |
| `libdrm` | Direct Rendering Manager |
| `mesa` | Mesa 3D graphics drivers (RADV, Iris, Zink) |
| `alsa-lib` | ALSA audio playback |
| `tar` & `xz` | Userspace decompression for rootless RS3 NXT client |

### Optional Dependencies (`optdepends`):
- `java-runtime`: Required for running RuneLite and HDOS.
- `gamemode`: Feral GameMode for CPU governor and process priority optimization.
- `mangohud`: Real-time hardware monitoring and FPS overlay.
