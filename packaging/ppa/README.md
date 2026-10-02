# 🚀 Complete Guide: Creating & Publishing an Ubuntu PPA on Launchpad

This guide provides a step-by-step walkthrough for configuring, building, and publishing an official **Ubuntu PPA (Personal Package Archive)** on Canonical's [Launchpad](https://launchpad.net) for **Linux Jagex Launcher**.

Target PPA: **`ppa:danielcook2016/linux-jagex-launcher`**  
Target Distributions: **Ubuntu 26.04 LTS (`resolute`)**, **Ubuntu 24.04 LTS (`noble`)**, and **Ubuntu 22.04 LTS (`jammy`)**

Once published, any Ubuntu, Linux Mint, Pop!_OS, or Debian-based user can install and receive automatic updates using:

```bash
sudo add-apt-repository ppa:danielcook2016/linux-jagex-launcher
sudo apt update
sudo apt install linux-jagex-launcher
```

---

## 📑 Table of Contents

1. [Understanding Launchpad PPAs](#1-understanding-launchpad-ppas)
2. [Step 1: Set Up Launchpad Account & GPG Key](#step-1-set-up-launchpad-account--gpg-key)
3. [Step 2: Verify Your PPA on Launchpad](#step-2-verify-your-ppa-on-launchpad)
4. [Step 3: Debian Packaging Structure](#step-3-debian-packaging-structure)
5. [Step 4: Build and Sign the Source Package Locally](#step-4-build-and-sign-the-source-package-locally)
6. [Step 5: Upload to Launchpad with `dput`](#step-5-upload-to-launchpad-with-dput)
7. [Step 6: Monitor Launchpad Cloud Build & Publishing](#step-6-monitor-launchpad-cloud-build--publishing)
8. [Automating Multi-Release Builds via GitHub Actions](#automating-multi-release-builds-via-github-actions)

---

## 1. Understanding Launchpad PPAs

Unlike standard software releases where you upload pre-compiled `.deb` binary files, **Launchpad builds `.deb` packages in Canonical's cloud builders from Debian Source Packages**.

A Debian Source Package consists of four files:
- `linux-jagex-launcher_1.4.4.orig.tar.gz`: The pristine upstream application bundle.
- `linux-jagex-launcher_1.4.4-1ubuntu1~noble.debian.tar.xz`: The `debian/` packaging instructions.
- `linux-jagex-launcher_1.4.4-1ubuntu1~noble.dsc`: The cryptographic descriptor file.
- `linux-jagex-launcher_1.4.4-1ubuntu1~noble_source.changes`: The GPG-signed upload manifest.

Launchpad strictly verifies your **GPG signature** against your Launchpad profile before accepting any upload.

---

## Step 1: Set Up Launchpad Account & GPG Key

### 1.1 Verify Launchpad Account
Ensure you are logged into [launchpad.net](https://launchpad.net) under username **`danielcook2016`**.

### 1.2 Generate an OpenPGP / GPG Key
On your Linux machine, generate a 4096-bit RSA key:

```bash
gpg --full-generate-key
```
Select the following options:
- **Kind of key:** `(1) RSA and RSA`
- **Keysize:** `4096`
- **Validity:** `0` (does not expire) or `2y`
- **Real name:** `Daniel Cook` (must match your Launchpad profile name)
- **Email address:** `danielcook2016@outlook.com` (must match your verified Launchpad email)

### 1.3 Find Your GPG Fingerprint
```bash
gpg --list-secret-keys --keyid-format=long
```

Output example:
```
sec   rsa4096/3AA5C34371567BD2 2026-09-30 [SC]
      8F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A
uid                 [ultimate] Daniel Cook <danielcook2016@outlook.com>
```
Your **fingerprint** is the 40-character hexadecimal string (`8F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A`).

### 1.4 Submit Public Key to Ubuntu Keyserver
Launchpad fetches public keys from Ubuntu's keyserver:

```bash
gpg --keyserver keyserver.ubuntu.com --send-keys <YOUR_40_CHAR_FINGERPRINT>
```
*(Wait 5–10 minutes for key propagation across server mirrors).*

### 1.5 Register the GPG Key in Launchpad
1. In Launchpad, go to your profile: [https://launchpad.net/~danielcook2016](https://launchpad.net/~danielcook2016)
2. Click **"Change details"** &rarr; select **"OpenPGP keys"** (or directly [https://launchpad.net/~danielcook2016/+editpgpkeys](https://launchpad.net/~danielcook2016/+editpgpkeys)).
3. Paste your 40-character fingerprint into the text box and click **Import Key**.
4. Launchpad will send an encrypted confirmation email to `danielcook2016@outlook.com`.
5. In your terminal, decrypt the verification link from the email:
   ```bash
   gpg --decrypt
   # (Paste the PGP MESSAGE block from the email, press Enter, then Ctrl+D)
   ```
6. Open the decrypted URL in your browser to confirm ownership.

---

## Step 2: Verify Your PPA on Launchpad

The PPA is already created at:
[https://launchpad.net/~danielcook2016/+archive/ubuntu/linux-jagex-launcher](https://launchpad.net/~danielcook2016/+archive/ubuntu/linux-jagex-launcher)

---

## Step 3: Debian Packaging Structure

This repository includes pre-configured Debian packaging files inside [`packaging/ppa/debian/`](file:///home/daniel-cook/Documents/Linux-Jagex-Launcher/packaging/ppa/debian/):

| File | Purpose |
|:---|:---|
| **`debian/changelog`** | Version tracking and target Ubuntu series (`resolute`, `noble`, `jammy`). Strictly follows Debian RFC 2822 formatting. |
| **`debian/control`** | Package metadata, maintainer identity, runtime dependencies (`libgtk-3-0t64 | libgtk-3-0`, `libnss3`, `libasound2t64 | libasound2`, `curl`, `tar`), recommendations (`gamemode`, `mangohud`). |
| **`debian/rules`** | Executable Makefile executing `dh $@` with desktop icon suite installation, strip exclusions (`-Xlinux-jagex-launcher -Xchrome-sandbox`), and sandbox permissions. |
| **`debian/install`** | Installs binary directory (`usr/lib/linux-jagex-launcher/*`), wrapper script (`usr/bin/linux-jagex-launcher`), and AppStream metadata. |
| **`debian/copyright`** | Machine-readable DEP-5 license file (MIT). |
| **`debian/source/format`** | Declares `3.0 (quilt)` packaging format. |

---

## Step 4: Build and Sign the Source Package Locally

### 4.1 Install Packaging Tools (Optional for Local Builds)
On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install -y devscripts debhelper build-essential dput rsync
```

### 4.2 Automated Build with Helper Script
Run the automated builder script included in this repository:

```bash
# Syntax: ./packaging/ppa/build-source-package.sh [PPA_TARGET] [SERIES] [GPG_KEY_ID]
./packaging/ppa/build-source-package.sh ppa:danielcook2016/linux-jagex-launcher resolute [GPG_KEY_ID]
```

This script automatically:
1. Compiles the Electron distribution (`release/linux-unpacked`) if not already built.
2. Stages application files, wrapper script, and icons into standard directory layout.
3. Generates a bit-for-bit reproducible `orig.tar.gz` archive (reusable across multiple Ubuntu releases without checksum collisions).
4. Configures `debian/changelog` for the target Ubuntu series (`resolute`, `noble`, `jammy`).
5. Executes `dpkg-buildpackage -S -sa` to generate signed source packages.

---

## Step 5: Upload to Launchpad with `dput`

Once signed, upload the generated `.changes` file:

```bash
dput ppa:danielcook2016/linux-jagex-launcher /tmp/ppa-build-XXXXXX/linux-jagex-launcher_1.4.4-1ubuntu1~noble_source.changes
```

Launchpad verifies:
1. GPG signature matches a registered key on `~danielcook2016`.
2. Changed-By email matches the key and profile.
3. Checksums in `.changes` match `.dsc` and `orig.tar.gz`.

---

## Step 6: Monitor Launchpad Cloud Build & Publishing

1. Visit: [https://launchpad.net/~danielcook2016/+archive/ubuntu/linux-jagex-launcher](https://launchpad.net/~danielcook2016/+archive/ubuntu/linux-jagex-launcher)
2. Under **"Package builds"**, you will see your package in the queue.
3. Launchpad will spin up a clean virtual machine builder to compile your `.deb` package on `amd64`.
4. Once the build status turns green (**Successfully built**), Launchpad signs the `.deb` and updates the APT repository indexes.
5. Within 15–30 minutes, users can install via `apt install linux-jagex-launcher`!

---

## Automating Multi-Release Builds via GitHub Actions

This repository includes an automated workflow [`.github/workflows/ppa.yml`](.github/workflows/ppa.yml) that builds and publishes for **Ubuntu 26.04 (Resolute)**, **Ubuntu 24.04 (Noble)**, and **Ubuntu 22.04 (Jammy)** automatically on every release.

### 1. Export Your GPG Private Key
On your local machine:
```bash
gpg --armor --export-secret-keys <YOUR_GPG_KEY_ID_OR_EMAIL> > launchpad-private.key
```

### 2. Configure GitHub Repository Secrets
Go to your GitHub repository &rarr; **Settings** &rarr; **Secrets and variables** &rarr; **Actions**:
- Click **"New repository secret"**:
  - Name: `LAUNCHPAD_GPG_KEY`
  - Secret: Paste the complete contents of `launchpad-private.key` (including `-----BEGIN PGP PRIVATE KEY BLOCK-----` and `-----END PGP PRIVATE KEY BLOCK-----`).
- (Optional, if you set a passphrase on the key):
  - Name: `LAUNCHPAD_GPG_PASSPHRASE`
  - Secret: Your GPG key passphrase.

### 3. Trigger the Workflow
- **Automatic:** Whenever a new GitHub Release is published (`v1.4.4`).
- **Manual (Workflow Dispatch):** Go to GitHub Actions &rarr; select **"Publish to Launchpad PPA"** &rarr; click **"Run workflow"** (choose `all`, `resolute`, `noble`, or `jammy`).
