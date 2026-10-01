# Debian & Ubuntu (.deb) Packaging for Linux Jagex Launcher

This directory contains the packaging specifications, configuration, and tools for building, installing, and distributing **Linux Jagex Launcher** as a native Debian/Ubuntu package (`.deb`).

---

## 1. Overview

The Debian package delivers Linux Jagex Launcher directly into `/opt/Jagex Launcher/` with a symlink at `/usr/bin/jagex-launcher` (or `/usr/bin/linux-jagex-launcher`), system menu desktop entries, MIME associations (`x-scheme-handler/jagex`, `x-scheme-handler/runescape`), and hi-color icon assets.

### Distribution Methods:
1. **Direct Standalone `.deb`:** Built via Electron Builder (`npm run dist:deb`) and distributed on GitHub Releases.
2. **Launchpad PPA (`ppa:danielcook2016/linux-jagex-launcher`):** Built from source packages in Canonical's Launchpad build farm for automatic system updates (see [`packaging/ppa/`](../ppa/)).
3. **Custom APT Repository:** Generated via [`generate-apt-repo.js`](./generate-apt-repo.js) for static hosting on GitHub Pages or custom web servers.

---

## 2. Building the `.deb` Locally

Build the standalone `.deb` package directly:

```bash
npm run dist:deb
```

The resulting package will be placed in `release/`:
```
release/jagex-launcher_1.4.3_amd64.deb
```

---

## 3. Package Dependencies & 64-bit Time (`t64`) Compatibility

The package defines comprehensive runtime dependencies with transitional alternatives to support both traditional distributions (Ubuntu 20.04/22.04, Debian 11/12) and modern 64-bit time (`t64`) distributions (Ubuntu 24.04 `noble`, Ubuntu 26.04 `resolute`):

| Package Dependency | Alternative / Transitional | Purpose |
|---|---|---|
| `libgtk-3-0` | `libgtk-3-0t64` | GTK+ 3 graphical toolkit |
| `libatspi2.0-0` | `libatspi2.0-0t64`, `libatspi-0` | Assistive technologies & accessibility |
| `libasound2` | `libasound2t64` | ALSA audio playback |
| `libnss3` | — | Network Security Services |
| `libxss1` | — | X11 Screen Saver extension |
| `libxtst6` | — | X11 Testing extension |
| `xdg-utils` | — | System desktop integration & URL handling |
| `libdrm2`, `libgbm1` | — | Direct rendering and GPU acceleration |
| `tar`, `xz-utils` | — | Client extraction utilities |

---

## 4. Local Installation & Testing

Install the built `.deb` using `apt` (recommended, resolves dependencies automatically):

```bash
sudo apt update
sudo apt install ./release/jagex-launcher_1.4.3_amd64.deb
```

Or using `dpkg`:
```bash
sudo dpkg -i ./release/jagex-launcher_1.4.3_amd64.deb
sudo apt-get install -f  # Fix any missing dependencies
```

---

## 5. Generating an APT Repository (Internal Maintainer Tool)

To index `.deb` files into a static APT repository structure:

```bash
node internal/scripts/generate-apt-repo.js
```

This generates `Packages`, `Packages.gz`, and `Release` files in `docs/apt/` with SHA-256 and MD5 cryptographic checksums.
