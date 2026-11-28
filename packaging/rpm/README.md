# Fedora, RHEL & openSUSE RPM Repository Guide

This directory contains the RPM specification and packaging metadata for **PatchCraft Launcher** (`patchcraft-launcher`) targeting **Fedora**, **Nobara**, **Bazzite**, **RHEL**, **CentOS Stream**, and **openSUSE**.

## Official Signed RPM Repository

PatchCraft Launcher is proprietary software and is distributed through its own GPG-signed RPM repository at [`https://repo.patchcraft.dev/rpm`](https://repo.patchcraft.dev/rpm) rather than Fedora Copr (which requires Fedora-approved FOSS licenses).

- **Repository Descriptor:** `https://repo.patchcraft.dev/rpm/patchcraft.repo`
- **Signing Key:** `https://repo.patchcraft.dev/gpg.asc`
- **Verification:** Both RPM packages (`gpgcheck=1`) and repository metadata (`repo_gpgcheck=1`) are GPG-signed.

### Fedora / Nobara / RHEL / CentOS Stream (DNF)

```bash
sudo curl -fsSL https://repo.patchcraft.dev/rpm/patchcraft.repo -o /etc/yum.repos.d/patchcraft.repo
sudo dnf install -y patchcraft-launcher
```

Future updates are delivered automatically through `sudo dnf upgrade`.

### openSUSE Tumbleweed / Leap (Zypper)

```bash
sudo zypper ar -f https://repo.patchcraft.dev/rpm/patchcraft.repo
sudo zypper refresh
sudo zypper install -y patchcraft-launcher
```

### Standalone `.rpm` Release Package

If you prefer a one-off download from [GitHub Releases](https://github.com/cook0001/Patchcraft-Launcher/releases):

```bash
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/patchcraft-launcher-2.0.1.x86_64.rpm
sudo dnf install -y ./patchcraft-launcher-2.0.1.x86_64.rpm
```

## Local RPM Building

If you have `rpm-build` or `mock` installed on a Fedora/RHEL host:

```bash
spectool -g -R packaging/rpm/patchcraft-launcher.spec
rpmbuild -ba packaging/rpm/patchcraft-launcher.spec
```

## Runtime Dependencies

| RPM Dependency | Purpose |
|:---|:---|
| `gtk3` | GTK 3 display toolkit |
| `nss` | Network Security Services |
| `libXScrnSaver` | X11 Screen Saver extension |
| `libXtst` | X11 Testing extension |
| `xdg-utils` | FreeDesktop URL handler & browser integration |
| `at-spi2-core` | Assistive technologies & accessibility bus |
| `libdrm` | Direct Rendering Manager |
| `mesa-libgbm` | Generic Buffer Management for GPU acceleration |
| `alsa-lib` | ALSA audio playback |
| `tar` & `xz` | Archive extraction for native RS3 client updates |
| `java-21-openjdk` *(Recommends)* | OpenJDK 21 for RuneLite and HDOS |
| `gamemode` *(Recommends)* | Feral GameMode process scheduling |
| `mangohud` *(Recommends)* | Hardware monitoring & FPS overlay |
