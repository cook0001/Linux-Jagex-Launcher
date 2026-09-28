<div align="center">
  <img src="docs/assets/icon.png" width="96" height="96" alt="Linux Jagex Launcher Logo" />
  <h1>Linux Jagex Launcher</h1>
  <p><strong>An authentic, native Jagex Launcher for Linux supporting RuneScape 3 and Old School RuneScape.</strong></p>

  <p>
    <a href="https://github.com/cook0001/Linux-Jagex-Launcher/actions/workflows/build.yml"><img src="https://github.com/cook0001/Linux-Jagex-Launcher/actions/workflows/build.yml/badge.svg" alt="Build Status" /></a>
    <a href="https://github.com/cook0001/Linux-Jagex-Launcher/releases"><img src="https://img.shields.io/github/v/release/cook0001/Linux-Jagex-Launcher?color=e5b352" alt="Latest Release" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
    <a href="https://github.com/cook0001/Linux-Jagex-Launcher"><img src="https://img.shields.io/badge/Platform-Linux-orange.svg" alt="Platform: Linux" /></a>
    <a href="https://cook0001.github.io/Linux-Jagex-Launcher/"><img src="https://img.shields.io/badge/Website-Online-00e1d9.svg" alt="Website" /></a>
  </p>

  <p>
    <a href="#-key-features">Key Features</a> •
    <a href="#-installation">Installation</a> •
    <a href="#-how-it-works">How It Works</a> •
    <a href="#-settings--tweaks">Settings & Tweaks</a> •
    <a href="#-faq--troubleshooting">FAQ</a> •
    <a href="PRIVACY.md">Privacy Policy</a>
  </p>

  <br />

  <img src="docs/assets/screenshot-osrs.png" alt="Linux Jagex Launcher running Old School RuneScape" width="900" style="border-radius: 10px; border: 1px solid rgba(229,179,82,0.3);" />
</div>

---

## 🌟 Overview

The **Linux Jagex Launcher** is an open-source, native desktop launcher built to replicate the **1:1 look, feel, and functionality of the official Windows/macOS Jagex Launcher** for Linux users.

Unlike generic third-party wrappers, this launcher:
1. **Replicates the exact official Jagex Launcher UI**, with hero promotional artwork, official maintenance PSA banners, news feed, character switcher, and authentic glowing controls.
2. **Runs native 64-bit Linux binaries**: Zero Wine, zero Proton, and zero translation layer overhead.
3. **Supports both RuneScape 3 and Old School RuneScape (OSRS)** with one-click access to **RuneLite**, **HDOS**, and the **Official Client**.
4. **Authenticates directly with Jagex** using standard OAuth 2.0 PKCE, with full support for Cloudflare Turnstile bot verification and Multi-Factor Authentication.

---

## ✨ Key Features

### ⚔️ Old School RuneScape
- **Multi-Client Dock Dropdown**: Switch seamlessly between **RuneLite**, **HDOS**, and the **Official Client** right from the bottom play bar.
- **RuneLite Integration**: Detects existing system installations or downloads the official launcher JAR automatically. Runs directly against your normal user profile, preserving all your `~/.runelite` plugins, tile markers, bank tags, screenshots, and browser links.
- **HDOS (High-Definition Open Source)**: Auto-downloads and verifies the latest HDOS launcher from official CDNs, passing your Jagex session ID for instant HD login.
- **Custom JVM & Memory Tuning**: Easily configure custom Java paths (Java 11/17/21), heap size parameters (e.g. `-Xmx2048m`), or custom launch flags.

### ⚡ RuneScape 3 (Native Linux)
- **Automatic Client Deployment**: Fetches and unpacks Jagex's official Ubuntu `.deb` package directly into your user space (`~/.local/share/linux-jagex-launcher/client/`) **without needing `sudo` or root permissions**.
- **Checksum Verification**: Validates official SHA-256 hashes on startup to ensure your game client is always authentic and up to date.
- **Audio & Display Integration**: Configures PulseAudio/PipeWire and SDL X11 window class hints out-of-the-box.

### 🛡️ Jagex Account Security & Privacy
- **Direct OAuth 2.0 with PKCE**: Connects straight to `account.jagex.com`. The launcher never touches or logs your plain-text password.
- **Interactive Cloudflare Turnstile Bypass**: Built-in compliant webview allows you to complete Turnstile checkboxes and 2FA challenges effortlessly.
- **100% Client-Side / Zero Telemetry**: No third-party servers, analytics, or tracking. Tokens (`JX_SESSION_ID`) and profile data reside exclusively in local user config (`~/.config/linux-jagex-launcher/`).

### 🚀 Gaming Enhancements
- **Zero RAM Mode ("Close on Launch")**: Automatically closes the launcher 1.5 seconds after your game launches, freeing 100% of the launcher's memory.
- **System Tray Mode**: Minimize cleanly to the system tray to keep characters ready without cluttering your taskbar.
- **Feral GameMode (`gamemoderun`)**: One-click toggle in Settings to optimize Linux CPU governors and scheduling priorities for your game.
- **MangoHud Integration**: One-click toggle to overlay real-time FPS, frame timing, and GPU/CPU thermals.

---

## 📥 Installation

Download the latest release package from the **[GitHub Releases page](https://github.com/cook0001/Linux-Jagex-Launcher/releases)**.

### Option 1: Debian / Ubuntu / Linux Mint (`.deb`)

**One-Line Fast Install:**
```bash
curl -sSL https://cook0001.github.io/Linux-Jagex-Launcher/install.sh | bash
```

**Or manual install via `apt`:**
```bash
# Download latest .deb from Releases:
curl -LO https://github.com/cook0001/Linux-Jagex-Launcher/releases/latest/download/jagex-launcher_1.0.0_amd64.deb

# Install package (apt automatically pulls all required system libraries):
sudo apt install ./jagex-launcher_1.0.0_amd64.deb
```

---

### Option 2: Arch Linux / Manjaro / SteamOS (AUR)

Install via any AUR helper:
```bash
# Using yay:
yay -S linux-jagex-launcher-bin

# Using paru:
paru -S linux-jagex-launcher-bin
```

---

### Option 3: Universal AppImage

Works on virtually any modern 64-bit Linux distribution (Ubuntu, Fedora, Arch, SteamOS, Debian, Mint):

```bash
# Download AppImage from Releases, make it executable, and run:
chmod +x Jagex-Launcher-1.0.0.AppImage
./Jagex-Launcher-1.0.0.AppImage
```

> **Steam Deck tip:** You can add the `.AppImage` as a "Non-Steam Game" in Steam Desktop mode to launch it directly from SteamOS Game Mode!

### Option 4: Build from Source

```bash
# Clone the repository
git clone https://github.com/cook0001/Linux-Jagex-Launcher.git
cd Linux-Jagex-Launcher

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or package native Linux binaries (AppImage, deb, tar.gz)
npm run dist
```

---

## 🔧 Settings & Customization

Click the **Gear icon** in the bottom-left dock to access the unified Settings Modal:

| Tab | Options |
|---|---|
| **General** | Close on Launch (0 MB RAM mode), Minimize to System Tray, Feral GameMode (`gamemoderun`), MangoHud overlay. |
| **Old School RuneScape** | Default client selection (RuneLite / HDOS / Official), Custom Java binary path, Custom executable/JAR override, Custom JVM arguments (`-Xmx`), Custom client flags, One-click client verify/reinstall. |
| **RuneScape 3** | Custom client binary override, Extra launch parameters, Client cache verification. |

---

## 🔍 How It Works

When you click **PLAY**:
1. The launcher retrieves your active character credentials (`JX_SESSION_ID`, `JX_CHARACTER_ID`, `JX_DISPLAY_NAME`) obtained via direct OAuth 2.0 with `account.jagex.com`.
2. The launcher prepares the target game client:
   - For **RuneLite**: Executes the launcher jar via `java -jar` (or native AppImage) while passing `--insecure-write-credentials` and session environment variables, pointing `HOME` to your regular user home directory.
   - For **HDOS**: Executes the official `hdos-launcher.jar` with `JX_SESSION_ID` and `JX_CHARACTER_ID` environment variables.
   - For **RuneScape 3**: Launches the native ELF `runescape` binary with SDL X11, PulseAudio/PipeWire variables, and `--configURI "https://www.runescape.com/k=5/l=0/jav_config.ws"`.
3. If enabled, the launcher terminates itself or minimizes to the tray to save memory.

---

## ❓ FAQ & Troubleshooting

<details>
<summary><strong>Will I get banned for using this launcher?</strong></summary>

No. This launcher does not alter game binaries, manipulate memory, or inject cheat code. It operates identically to how the official launcher launches clients on Windows and macOS: by requesting an official OAuth2 token from Jagex and passing standard environment variables to the game client subprocess.
</details>

<details>
<summary><strong>Do my RuneLite plugins and bank tags stay saved?</strong></summary>

Yes! The launcher respects your system user profile. All configuration, plugins, screenshots, and tile markers in `~/.runelite` remain completely untouched.
</details>

<details>
<summary><strong>AppImage won't open on Ubuntu 24.04 or Fedora?</strong></summary>

Modern distributions may require the FUSE library to run AppImages:
```bash
# Ubuntu / Debian
sudo apt install libfuse2t64  # or libfuse2 on 22.04

# Fedora
sudo dnf install fuse-libs
```
Alternatively, install the `.deb` package instead!
</details>

<details>
<summary><strong>How do I log out or switch Jagex accounts?</strong></summary>

Click on your character name in the bottom dock to switch between saved characters, or click **"Log Out"** to clear stored tokens and sign into a different Jagex account.
</details>

---

## 🤝 Contributing

Contributions, bug reports, and suggestions are warmly welcomed! Please read [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

---

## 📄 License & Legal Notice

This project is licensed under the [MIT License](LICENSE).

**Trademark Disclaimer:**  
*RuneScape*, *Old School RuneScape*, and *Jagex* are registered trademarks of Jagex Limited in the United Kingdom, United States, and other countries. This software is an independent open-source project and is not affiliated with, endorsed by, sponsored by, or associated with Jagex Limited.
