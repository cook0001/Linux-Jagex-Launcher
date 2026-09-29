# Flatpak & Flathub Packaging Guide

This directory contains the required assets and specifications to package **Linux Jagex Launcher** for [Flathub](https://flathub.org).

## Files in this Directory

- `io.github.cook0001.LinuxJagexLauncher.metainfo.xml`: AppStream metadata file providing store description, screenshots, developer attribution, and content rating.
- `io.github.cook0001.LinuxJagexLauncher.desktop`: FreeDesktop application entry conforming to the `io.github.cook0001.LinuxJagexLauncher` App ID.
- `io.github.cook0001.LinuxJagexLauncher.yml`: Flatpak manifest defining runtime, SDK, sandbox permissions, and build steps.

---

## Flathub Prerequisites Checklist

Flathub reviewers enforce specific rules before an application can be published:

1. **Reverse-DNS Application ID**:
   - Must use `io.github.cook0001.LinuxJagexLauncher` (derived from your verified GitHub username `cook0001`).
   - You *cannot* use `com.jagex.*` because Jagex owns that domain name.

2. **Sandbox Permissions & Runtime Requirements**:
   - **Java Runtime**: RuneLite and HDOS require Java 11+. The manifest includes the `org.freedesktop.Sdk.Extension.openjdk21` extension so players do not encounter missing Java errors inside the sandbox.
   - **RuneScape 3 Legacy Dependencies (OpenSSL 1.1 & GTK2)**: The native RS3 NXT client was built for Ubuntu Trusty/Xenial and dynamically links against `libssl.so.1.1`, `libcrypto.so.1.1`, and GTK 2.0. The manifest includes `openssl-1.1.1w` and `shared-modules/gtk2/gtk2.json` to ensure RS3 runs out of the box on all modern distributions without host system library hacks.
   - **User Settings & Cache**: `--filesystem=~/.runelite:create`, `--filesystem=~/.jagex_launcher:create`, and `--filesystem=~/.jagex_cache_32:create` ensure players retain their plugins, tile markers, bank tags, and RS3 cache across sessions.
   - **Hardware Acceleration**: `--device=dri` and `--device=all` provide native GPU and Vulkan device access for RS3 NXT, RuneLite GPU plugin, and HDOS.
   - **Steam / Browser Portal**: `--talk-name=org.freedesktop.portal.OpenURI` allows Dragonwilds to launch Steam and allows RuneLite to open browser links.

3. **Offline Build Pipeline**:
   - Flathub builders operate with **no network access** during module compilation.
   - For Electron/Node apps, dependency tarballs must be generated offline using [flatpak-node-generator](https://github.com/flatpak/flatpak-builder-tools/tree/master/node):
     ```bash
     python3 flatpak-node-generator.py npm package-lock.json -o packaging/flatpak/node-sources.json
     ```

---

## How to Test Locally

Ensure you have `flatpak` and `flatpak-builder` installed:

```bash
# 1. Install Freedesktop runtime and SDK
flatpak install flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 org.freedesktop.Sdk.Extension.openjdk21//24.08 org.flatpak.Builder

# 2. Run Flathub linters locally
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.yml
flatpak run --command=appstreamcli org.freedesktop.Sdk validate packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.metainfo.xml

# 3. Test build the Flatpak locally
flatpak-builder --user --install --force-clean build-dir packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.yml

# 4. Test run the built Flatpak
flatpak run io.github.cook0001.LinuxJagexLauncher
```

---

## 🚀 Submitting to Flathub (Official Process)

Follow the official [Flathub Submission Guide](https://docs.flathub.org/docs/for-app-authors/submission):

1. **Fork the Official Flathub Repository**:
   Fork [flathub/flathub](https://github.com/flathub/flathub) on GitHub. Ensure "Copy the `master` branch only" is **unchecked** so that all branches are available.

2. **Create a Submission Branch based on `new-pr`**:
   ```bash
   git clone https://github.com/<your-username>/flathub.git
   cd flathub
   # Check out the new-pr branch (DO NOT branch off master!)
   git checkout -b add-linux-jagex-launcher origin/new-pr
   ```

3. **Add Manifest & Packaging Files**:
   Create a directory or add your files matching your App ID:
   - `io.github.cook0001.LinuxJagexLauncher.yml`
   - `io.github.cook0001.LinuxJagexLauncher.metainfo.xml`
   - `io.github.cook0001.LinuxJagexLauncher.desktop`
   - (If using offline npm dependencies) `node-sources.json`

4. **Open a Pull Request**:
   - **Target Repository**: `flathub/flathub`
   - **Base Branch**: `new-pr` (⚠️ **Never open against `master`**)
   - **PR Title**: `Add io.github.cook0001.LinuxJagexLauncher`
   - **PR Description Checklist**: Fill out the official checklist template completely. Ensure you adhere to Flathub policies (e.g. human-written PR and review responses).

5. **CI Bot Build & Review**:
   - The Flathub bot (`flathubbot`) will automatically run `flatpak-builder-lint` and attempt a test build on x86_64.
   - If needed, trigger a build by commenting `bot, build`.
   - Maintainers will review the submission. Once approved and merged, a new repository `flathub/io.github.cook0001.LinuxJagexLauncher` will be created automatically.

6. **Flathub Developer Verification**:
   - Once published, log into [flathub.org](https://flathub.org) using your `cook0001` GitHub account.
   - Flathub automatically verifies domain ownership for `io.github.cook0001.*`, granting your app the official **Verified Developer Checkmark**!

