# 🚀 Complete Guide: Creating & Publishing an Ubuntu PPA on Launchpad

This guide provides a step-by-step walkthrough for creating, configuring, building, and publishing an official **Ubuntu PPA (Personal Package Archive)** on Canonical's [Launchpad](https://launchpad.net) for **Linux Jagex Launcher**.

Once published, any Ubuntu, Linux Mint, Pop!_OS, or Debian-compatible user can install and receive automatic updates using:

```bash
sudo add-apt-repository ppa:cook0001/ppa
sudo apt update
sudo apt install linux-jagex-launcher
```

---

## 📑 Table of Contents

1. [Understanding Launchpad PPAs](#1-understanding-launchpad-ppas)
2. [Step 1: Set Up Launchpad Account & GPG Key](#step-1-set-up-launchpad-account--gpg-key)
3. [Step 2: Create Your PPA on Launchpad](#step-2-create-your-ppa-on-launchpad)
4. [Step 3: Debian Packaging Structure](#step-3-debian-packaging-structure)
5. [Step 4: Build and Sign the Source Package](#step-4-build-and-sign-the-source-package)
6. [Step 5: Upload to Launchpad with `dput`](#step-5-upload-to-launchpad-with-dput)
7. [Step 6: Monitor Launchpad Cloud Build & Publishing](#step-6-monitor-launchpad-cloud-build--publishing)
8. [Multi-Release Support (Noble 24.04, Jammy 22.04, etc.)](#multi-release-support)
9. [Automating with GitHub Actions](#automating-with-github-actions)

---

## 1. Understanding Launchpad PPAs

Unlike standard software releases where you upload pre-compiled `.deb` binary files, **Launchpad builds `.deb` packages in Canonical's cloud builders from Debian Source Packages**.

A Debian Source Package consists of four files:
- `linux-jagex-launcher_1.0.0.orig.tar.gz`: The pristine upstream source code.
- `linux-jagex-launcher_1.0.0-1ubuntu1~noble.debian.tar.xz`: The `debian/` packaging instructions.
- `linux-jagex-launcher_1.0.0-1ubuntu1~noble.dsc`: The cryptographic descriptor file.
- `linux-jagex-launcher_1.0.0-1ubuntu1~noble_source.changes`: The GPG-signed upload manifest.

Launchpad strictly verifies your **GPG signature** against your Launchpad profile before accepting any upload.

---

## Step 1: Set Up Launchpad Account & GPG Key

### 1.1 Create a Launchpad Account
1. Visit [launchpad.net](https://launchpad.net) and create an Ubuntu One account.
2. Choose your username (e.g., `cook0001`).

### 1.2 Generate an OpenPGP / GPG Key
On your Linux machine (or Linux VM / WSL), generate a 4096-bit RSA key:

```bash
gpg --full-generate-key
```
- **Kind of key:** `(1) RSA and RSA`
- **Keysize:** `4096`
- **Validity:** `0` (does not expire) or `2y`
- **Real name:** `Daniel Cook` (matches your Launchpad profile name)
- **Email address:** Your email registered on Launchpad / Ubuntu One

### 1.3 Find Your GPG Fingerprint
```bash
gpg --list-secret-keys --keyid-format=long
```

Output example:
```
sec   rsa4096/3AA5C34371567BD2 2026-09-28 [SC]
      8F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A
uid                 [ultimate] Daniel Cook <your-email@example.com>
```
Your **fingerprint** is the 40-character hexadecimal string (`8F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A`).

### 1.4 Submit Public Key to Ubuntu Keyserver
Launchpad fetches public keys from Ubuntu's keyserver:

```bash
gpg --keyserver keyserver.ubuntu.com --send-keys 8F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A
```
*(Wait 5–10 minutes for key propagation across server mirrors).*

### 1.5 Register the GPG Key in Launchpad
1. In Launchpad, go to your profile: `https://launchpad.net/~<your-username>`
2. Click **"Change details"** &rarr; select **"OpenPGP keys"** (or go to `https://launchpad.net/~<your-username>/+editpgpkeys`).
3. Paste your 40-character fingerprint into the text box and click **Import Key**.
4. Launchpad will send an encrypted confirmation email to the address on your GPG key.
5. In your terminal, decrypt the verification link:
   ```bash
   gpg --decrypt
   # (Paste the PGP MESSAGE block from the email, press Enter, then Ctrl+D)
   ```
6. Open the decrypted URL in your browser to confirm ownership.

---

## Step 2: Create Your PPA on Launchpad

1. Go to your Launchpad profile: `https://launchpad.net/~<your-username>`
2. Click **"Create a new PPA"**.
3. Fill out the form:
   - **PPA Name:** `ppa` (creates `ppa:<username>/ppa`) or `linux-jagex-launcher` (creates `ppa:<username>/linux-jagex-launcher`).
   - **Display name:** `Linux Jagex Launcher PPA`
   - **Description:** `Official PPA repository for the native Linux Jagex Launcher.`
4. Click **Activate**.

---

## Step 3: Debian Packaging Structure

This repository includes pre-configured Debian packaging files inside [`packaging/ppa/debian/`](file:///Users/danielc/Documents/Linux-jagex-launcher/packaging/ppa/debian/):

| File | Purpose |
|:---|:---|
| **`debian/changelog`** | Version tracking and target Ubuntu series (`noble`, `jammy`). Must follow Debian RFC 2822 formatting. |
| **`debian/control`** | Package metadata, runtime dependencies (`libgtk-3-0`, `libnss3`, `libasound2`, `curl`, `tar`), recommendations (`gamemode`, `mangohud`). |
| **`debian/rules`** | Executable Makefile executing `dh $@` build rules with debug symbol overrides. |
| **`debian/install`** | Declares where binaries, desktop entries, and icon suites are installed in `/usr/`. |
| **`debian/copyright`** | Machine-readable DEP-5 license file (MIT). |
| **`debian/source/format`** | Declares `3.0 (quilt)` packaging format. |

---

## Step 4: Build and Sign the Source Package

### 4.1 Install Packaging Tools
On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install devscripts debhelper build-essential dput rsync
```

### 4.2 Automated Build with Helper Script
Run the automated builder script included in this repository:

```bash
# Syntax: ./packaging/ppa/build-source-package.sh <PPA_TARGET> <SERIES> [GPG_KEY_ID]
./packaging/ppa/build-source-package.sh ppa:cook0001/ppa noble 8F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A
```

This script automatically:
1. Gathers the repository source files (excluding `.git`, `node_modules`, `dist`).
2. Generates the `orig.tar.gz` pristine archive.
3. Sets the target Ubuntu series (`noble`, `jammy`).
4. Runs `debuild -S -sa` to generate signed source packages.

---

## Step 5: Upload to Launchpad with `dput`

Configure `dput` if not already set:

```bash
# Upload the generated .changes manifest:
dput ppa:cook0001/ppa ../linux-jagex-launcher_1.0.0-1ubuntu1~noble_source.changes
```

Output:
```
Checking signature on .changes
gpg: Good signature from "Daniel Cook <your-email@example.com>"
Good signature on /path/to/linux-jagex-launcher_1.0.0-1ubuntu1~noble_source.changes.
Uploading linux-jagex-launcher_1.0.0-1ubuntu1~noble.dsc
Uploading linux-jagex-launcher_1.0.0.orig.tar.gz
Uploading linux-jagex-launcher_1.0.0-1ubuntu1~noble.debian.tar.xz
Uploading linux-jagex-launcher_1.0.0-1ubuntu1~noble_source.changes
Package successfully uploaded to ppa.launchpad.net.
```

---

## Step 6: Monitor Launchpad Cloud Build & Publishing

1. Visit your PPA web page: `https://launchpad.net/~<your-username>/+archive/ubuntu/<ppa-name>`
2. Under **"Package builds"**, you will see your package in the queue.
3. Launchpad will spin up a clean virtual machine builder to compile your `.deb` package on `amd64`.
4. Once the build status turns green (**Successfully built**), Launchpad signs the `.deb` and updates the `Release` and `Packages` indexes.
5. Within 15–30 minutes, users can install via `apt`!

---

## Multi-Release Support

Ubuntu users may run different LTS versions:
- **Ubuntu 24.04 LTS:** `noble`
- **Ubuntu 22.04 LTS:** `jammy`
- **Ubuntu 20.04 LTS:** `focal`

### Method A: Use Launchpad's "Copy Packages" Feature (Fastest)
Once your package builds successfully for `noble`:
1. Go to your PPA page on Launchpad.
2. Click **"View package details"**.
3. Select `linux-jagex-launcher` &rarr; click **"Copy packages"**.
4. Select destination series: **Jammy (22.04 LTS)**.
5. Choose **"Copy existing binaries"** &rarr; click **Copy Packages**.
*(This instantly publishes the package to older Ubuntu releases without recompiling!)*

### Method B: Upload Release-Specific Source Packages
```bash
# Build for Jammy (22.04):
./packaging/ppa/build-source-package.sh ppa:cook0001/ppa jammy <GPG_KEY>
```

---

## Automating with GitHub Actions

You can automate PPA uploads on every release tag using GitHub Actions.

### 1. Export Your GPG Private Key
```bash
gpg --armor --export-secret-keys 8F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A > gpg-private.key
```

### 2. Add Secrets to GitHub
In your GitHub repo &rarr; **Settings** &rarr; **Secrets and variables** &rarr; **Actions**:
- `LAUNCHPAD_GPG_KEY`: The contents of `gpg-private.key`
- `LAUNCHPAD_GPG_PASSPHRASE`: The passphrase for your GPG key (if set)

### 3. GitHub Actions Workflow (`.github/workflows/ppa.yml`)
```yaml
name: Publish to Launchpad PPA

on:
  release:
    types: [published]
  workflow_dispatch:

jobs:
  ppa-upload:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4

      - name: Install Debian Packaging Tools
        run: |
          sudo apt update
          sudo apt install -y devscripts debhelper build-essential dput rsync

      - name: Import GPG Key
        run: |
          echo "${{ secrets.LAUNCHPAD_GPG_KEY }}" | gpg --batch --import

      - name: Build & Upload to Launchpad
        run: |
          chmod +x packaging/ppa/build-source-package.sh
          # Build and upload for Ubuntu 24.04 (Noble)
          ./packaging/ppa/build-source-package.sh ppa:cook0001/ppa noble
```
