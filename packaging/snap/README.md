# Snap Packaging for Linux Jagex Launcher

This directory contains the packaging specifications, configuration, and documentation for building and releasing **Linux Jagex Launcher** as a Canonical Snap package.

---

## 1. Overview

The Snap package provides a containerized, self-updating distribution of Linux Jagex Launcher for Ubuntu, Debian, Fedora, Arch Linux, openSUSE, and any distribution running `snapd`.

### Confinement & Security

- **Confinement:** `strict` (sandboxed using AppArmor and seccomp profiles).
- **Desktop Environment:** Uses the `gnome` desktop runtime extension for Wayland, X11, GTK themes, and font rendering.
- **Interfaces (Plugs):**
  - `desktop` / `desktop-legacy`: Application menu and dock integration.
  - `x11` / `wayland`: Dual display server support.
  - `browser-support`: Chromium content engine sandboxing.
  - `network` / `network-bind`: Jagex OAuth authentication and update checking.
  - `audio-playback` / `pulseaudio`: Native game sound output.
  - `opengl`: Direct hardware-accelerated 3D rendering (Mesa, NVIDIA, AMD).
  - `removable-media`: Access games installed on secondary SSDs or external storage (`/media`, `/mnt`).
  - `joystick`: Gamepad and Steam Deck controller support.
  - `process-control`: Managing and monitoring client subprocesses cleanly.

### Storage Persistence (`SNAP_USER_COMMON`)

To prevent multi-gigabyte client caches (such as the RuneScape NXT cache or RuneLite assets) from being duplicated upon every snap automatic update, the launcher automatically detects when it is running inside a Snap environment (`$SNAP` / `$SNAP_USER_COMMON`) and stores game data and configuration in:

```
~/snap/linux-jagex-launcher/common/
├── .config/linux-jagex-launcher/       # Saved sessions & launcher settings
└── .local/share/linux-jagex-launcher/  # Game clients, compat libraries, and NXT cache
```

---

## 2. Building the Snap Locally

### Method A: Fast Local Build via Electron Builder (Recommended)

Build the `.snap` package directly using the pre-configured electron-builder pipeline:

```bash
npm run dist:snap
```

The resulting package will be placed in `release/`:
```
release/linux-jagex-launcher_1.4.4_amd64.snap
```

### Method B: Native Snapcraft Build

You can also build the snap using Canonical's official `snapcraft` CLI:

```bash
# Compile the unpacked Electron application first
npm run build
npx electron-builder --linux --dir

# Build the snap container
snapcraft --destructive-mode
```

---

## 3. Local Installation & Testing

Install the locally built snap with the `--dangerous` flag (required for unsigned local packages):

```bash
sudo snap install --dangerous ./release/linux-jagex-launcher_1.4.4_amd64.snap
```

### Connect Plugs (Optional Interfaces)

Certain plugs such as `removable-media` and `joystick` require manual or automatic interface connection on strict snaps:

```bash
# Enable access to external storage / secondary game drives
sudo snap connect linux-jagex-launcher:removable-media

# Enable gamepad / joystick input
sudo snap connect linux-jagex-launcher:joystick

# Enable process monitoring
sudo snap connect linux-jagex-launcher:process-control
```

### Run the Installed Snap

```bash
# Run from command line
snap run linux-jagex-launcher

# Or launch directly from GNOME / KDE Application Menu
```

---

## 4. Snap Store Registration & Publishing

To publish the snap to the Canonical Snap Store (`https://snapcraft.io`):

1. **Log in to Snapcraft:**
   ```bash
   snapcraft login
   ```

2. **Register the snap package name:**
   ```bash
   snapcraft register linux-jagex-launcher
   ```

3. **Upload and release to the stable channel:**
   ```bash
   snapcraft upload ./release/linux-jagex-launcher_1.4.4_amd64.snap --release=stable
   ```

4. **Or upload to the edge/candidate channel for beta testing:**
   ```bash
   snapcraft upload ./release/linux-jagex-launcher_1.4.4_amd64.snap --release=candidate
   ```

---

## 5. Snap Store Media & Banner Specifications

Canonical's Snap Store requires promotional banners for the store listing with strict constraints:

| Specification | Requirement | Provided Asset | Compliance |
|---|---|---|---|
| **Format** | PNG or JPEG | `snap-store-banner.png` / `snap-store-banner.jpg` | ✓ Passed |
| **Aspect Ratio** | 3:1 | 2160 x 720 (3.00:1) & 4320 x 1440 (3.00:1) | ✓ Passed |
| **Min Resolution** | 720 x 240 px | 2160 x 720 px | ✓ Passed |
| **Max Resolution** | 4320 x 1440 px | 4320 x 1440 px (Maximum tier) | ✓ Passed |
| **File Size Limit** | < 2.0 MB | PNG: ~1.42 MB, JPG: ~0.20 MB | ✓ Passed |

### Store Banner Assets & Generator

Promotional banners and generation tooling are maintained locally in `internal/` (ignored by Git) for maintainer use:
- `internal/banners/snap-store-banner.png` (2160 x 720, 3:1 HiDPI, PNG, ~1.4 MB)
- `internal/banners/snap-store-banner.jpg` (2160 x 720, 3:1 HiDPI, JPEG, ~200 KB)
- `internal/banners/snap-store-banner-4320x1440.jpg` (4320 x 1440, 3:1 Maximum allowed resolution, JPEG, ~450 KB)
- `internal/banners/snap-store-banner-1440x480.png` (1440 x 480 Standard banner, PNG)
- `internal/scripts/generate-snap-banner.cjs` (Banner generator script)

### Packaging Directory Structure:
```
packaging/snap/
├── README.md                        # Comprehensive Snapcraft guide
├── snapcraft.yaml                   # Canonical Snapcraft packaging specification
└── gui/
    ├── linux-jagex-launcher.desktop # App menu desktop definition
    └── icon.png                     # 512x512 application icon
```

To re-generate or adjust banners at any time:
```bash
node internal/scripts/generate-snap-banner.cjs
```


