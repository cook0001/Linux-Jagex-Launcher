# 📦 Fedora RPM & Copr Packaging Guide

This directory contains the RPM package specification and build configuration for **Linux Jagex Launcher** (`linux-jagex-launcher`) targeting **Fedora**, **Red Hat Enterprise Linux (RHEL)**, **CentOS Stream**, **Nobara**, and **Bazzite**.

---

## 📑 Table of Contents

1. [Fedora Copr Overview](#1-fedora-copr-overview)
2. [Step-by-Step Copr Project Setup](#2-step-by-step-copr-project-setup)
3. [Automated Rebuilds via GitHub Webhooks](#3-automated-rebuilds-via-github-webhooks)
4. [Local RPM Building with `mock` or `rpmbuild`](#4-local-rpm-building)
5. [User Installation Instructions](#5-user-installation-instructions)

---

## 1. Fedora Copr Overview

[Fedora Copr](https://copr.fedorainfracloud.org/) is Fedora's automated build and repository hosting service (equivalent to Launchpad PPA for Ubuntu or AUR for Arch).

- **Project Target:** `cook0001/linux-jagex-launcher`
- **Supported Targets:** Fedora 40, Fedora 41, Fedora 42, Fedora Rawhide, EPEL 9, EPEL 10
- **Package Spec:** [`linux-jagex-launcher.spec`](./linux-jagex-launcher.spec)
- **Upstream Source:** GitHub Release tarball (`linux-jagex-launcher-%{version}.tar.gz`)

---

## 2. Step-by-Step Copr Project Setup

Follow these steps to set up the automated Copr repository:

### Step 1: Create a Fedora Account (FAS)
1. Go to [https://accounts.fedoraproject.org/](https://accounts.fedoraproject.org/) and create or sign in with your Fedora Account.
2. Sign in to [https://copr.fedorainfracloud.org/](https://copr.fedorainfracloud.org/).

### Step 2: Create a New Copr Project
1. Click **New Project**.
2. **Project name:** `linux-jagex-launcher`
3. **Description:**
   ```
   Authentic, native Jagex Launcher for Linux supporting RuneScape 3 and Old School RuneScape (RuneLite, HDOS, and Official client).
   ```
4. **Instructions:**
   ```bash
   sudo dnf copr enable cook0001/linux-jagex-launcher
   sudo dnf install linux-jagex-launcher
   ```
5. **Chroots:** Check all active Fedora releases:
   - `fedora-40-x86_64`
   - `fedora-41-x86_64`
   - `fedora-rawhide-x86_64`
   - `epel-9-x86_64`
   - `epel-10-x86_64`
6. **Follow Fedora branching:** Enable this checkbox so new Fedora releases are added automatically.
7. Click **Save**.

### Step 3: Add the Package
1. In your new project, navigate to **Packages** → **New Package**.
2. **Package name:** `linux-jagex-launcher`
3. **Source type:** Select **SCM (Git)**.
4. **Clone URL:** `https://github.com/cook0001/Linux-Jagex-Launcher.git`
5. **Branch:** `main`
6. **Spec file path:** `packaging/rpm/linux-jagex-launcher.spec`
7. Click **Create**.

---

## 3. Automated Rebuilds via GitHub Webhooks

To have Copr automatically build and publish a new RPM whenever you push a new release:

1. In Copr, go to **Settings** → **Integrations**.
2. Copy the **GitHub webhook URL** and secret.
3. In your GitHub repository:
   - Go to **Settings** → **Webhooks** → **Add webhook**.
   - **Payload URL:** Paste the Copr webhook URL.
   - **Content type:** `application/json`
   - **Secret:** Paste the Copr webhook secret.
   - **Events:** Select *"Let me select individual events"* and check **Releases** and **Pushes**.
   - Click **Add webhook**.

Whenever a new version tag (e.g. `v1.4.4`) is pushed to GitHub, Copr will automatically pull the updated spec and build packages for all selected Fedora/EPEL architectures.

---

## 4. Local RPM Building

If you have a Fedora/RHEL system or `rpm-build` / `mock` installed:

```bash
# 1. Download upstream release sources
spectool -g -R packaging/rpm/linux-jagex-launcher.spec

# 2. Build the Source RPM (SRPM)
rpmbuild -bs packaging/rpm/linux-jagex-launcher.spec

# 3. Build the binary RPM locally
rpmbuild -ba packaging/rpm/linux-jagex-launcher.spec
```

Or using `mock` for clean chroot isolation:
```bash
mock -r fedora-41-x86_64 rebuild /path/to/linux-jagex-launcher-*.src.rpm
```

---

## 5. User Installation Instructions

### Method A: Fedora / Nobara / Bazzite (DNF)

```bash
# 1. Enable the Copr repository
sudo dnf copr enable cook0001/linux-jagex-launcher

# 2. Install Linux Jagex Launcher
sudo dnf install linux-jagex-launcher
```

### Method B: CentOS Stream / RHEL 9/10

```bash
# 1. Enable EPEL and Copr plugin
sudo dnf install -y epel-release dnf-plugins-core

# 2. Enable Copr and install
sudo dnf copr enable cook0001/linux-jagex-launcher
sudo dnf install linux-jagex-launcher
```

---

## 6. Runtime Dependencies & Compatibility

The package automatically pulls the necessary runtime libraries:

| RPM Dependency | Purpose |
|:---|:---|
| `gtk3` | GTK+ 3 display toolkit |
| `nss` | Network Security Services |
| `libXScrnSaver` | X11 Screen Saver extension |
| `libXtst` | X11 Testing extension |
| `xdg-utils` | FreeDesktop URL handler & browser integration |
| `at-spi2-core` | Assistive technologies & accessibility bus |
| `libdrm` | Direct Rendering Manager |
| `mesa-libgbm` | Generic Buffer Management for GPU acceleration |
| `alsa-lib` | ALSA audio playback |
| `java-21-openjdk` *(Recommends)* | OpenJDK 21 for RuneLite and HDOS |
| `gamemode` *(Recommends)* | Feral GameMode process scheduling |
| `mangohud` *(Recommends)* | Hardware monitoring & FPS overlay |
