<div align="center">
  <img src="docs/assets/banner.png" alt="PatchCraft Launcher Banner" width="100%" style="border-radius: 12px; margin-bottom: 20px;" />

  <img src="docs/assets/icon.png" width="96" height="96" alt="PatchCraft Launcher Logo" />
  <h1>PatchCraft Launcher</h1>
  <p><strong>Unofficial native Linux launcher for RuneScape 3, Old School RuneScape, and RuneScape: Dragonwilds (Jagex Accounts).</strong></p>
  <p><sub>Formerly Linux Jagex Launcher &mdash; packages use the <code>patchcraft-launcher</code> slug with legacy <code>linux-jagex-launcher</code> CLI symlinks preserved; the Snap Store listing currently remains under <code>linux-jagex-launcher</code>. Not affiliated with Jagex Ltd.</sub></p>

  <p>
    <a href="https://github.com/cook0001/Patchcraft-Launcher/releases"><img src="https://img.shields.io/github/v/release/cook0001/Patchcraft-Launcher?color=e5b352" alt="Latest Release" /></a>
    <a href="https://github.com/cook0001/Patchcraft-Launcher/releases"><img src="https://img.shields.io/github/downloads/cook0001/Patchcraft-Launcher/total?color=10b981" alt="Total Downloads" /></a>
    <a href="https://snapcraft.io/patchcraft-launcher"><img alt="patchcraft-launcher" src="https://snapcraft.io/patchcraft-launcher/badge.svg" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="License: Proprietary" /></a>
    <a href="https://github.com/cook0001/Patchcraft-Launcher"><img src="https://img.shields.io/badge/Platform-Linux-orange.svg" alt="Platform: Linux" /></a>
    <a href="https://launcher.patchcraft.dev/"><img src="https://img.shields.io/badge/Website-Online-00e1d9.svg" alt="Website" /></a>
  </p>

  <p>
    <a href="https://snapcraft.io/patchcraft-launcher">
      <img alt="Get it from the Snap Store" src="https://snapcraft.io/en/dark/install.svg" />
    </a>
  </p>

  <p>
    <a href="#-key-features">Key Features</a> •
    <a href="#-how-it-compares">How It Compares</a> •
    <a href="#-runescape-3-native-linux">RuneScape 3</a> •
    <a href="#-old-school-runescape">Old School</a> •
    <a href="#-runescape-dragonwilds">Dragonwilds</a> •
    <a href="#-installation">Installation</a> •
    <a href="#-how-it-works">How It Works</a> •
    <a href="#-settings--tweaks">Settings</a> •
    <a href="#-faq--troubleshooting">FAQ</a> •
    <a href="https://github.com/cook0001/Patchcraft-Launcher/discussions" target="_blank">Discussions</a> •
    <a href="https://forms.gle/KvagBxcmVBB3Q721A" target="_blank">Feedback Form</a> •
    <a href="https://ko-fi.com/patchcraft" target="_blank">Support (Ko-fi)</a> •
    <a href="PRIVACY.md">Privacy Policy</a>
  </p>

  <br />

  <img src="docs/assets/screenshot-rs3.png" alt="PatchCraft Launcher running RuneScape 3 on Linux" width="900" style="border-radius: 10px; border: 1px solid rgba(229,179,82,0.3);" />
</div>

---

## 🌟 Overview

The **PatchCraft Launcher** (formerly *Linux Jagex Launcher*) is an unofficial native desktop launcher for Linux and SteamOS built for **RuneScape 3**, **Old School RuneScape**, and **RuneScape: Dragonwilds** with Jagex Accounts.

Unlike third-party wrappers or Wine prefixes, this launcher:
1. **Provides a familiar launcher layout**, with live promotional hero banners, maintenance PSA notices, news feeds, character switcher, and native Linux window controls.
2. **Runs native 64-bit Linux binaries**: Zero Wine, zero Proton, and zero emulation overhead for RuneScape 3.
3. **Supports all three Jagex ecosystem titles**: **RuneScape 3 (NXT Client)**, **Old School RuneScape** (RuneLite, HDOS, and the Official Client), and **RuneScape: Dragonwilds**.
4. **Authenticates directly with Jagex** using standard OAuth 2.0 PKCE, with built-in support for Cloudflare Turnstile bot verification and Multi-Factor Authentication.

---

## ⚖️ How It Compares

If you want to play RuneScape on Linux today, you generally encounter three existing approaches: **TormStorm's Flatpak**, **Bolt Launcher**, or Jagex's **official legacy client / beta workarounds**.

Here is how **PatchCraft Launcher** compares and what it does differently:

### 📊 Feature Comparison Matrix

| Feature / Capability | **PatchCraft Launcher (This Project)** | **TormStorm's Flatpak (`com.jagex.Launcher`)** | **Bolt Launcher** | **Official Legacy Client / Jagex "Beta"** |
|:---|:---:|:---:|:---:|:---:|
| **RuneScape 3 Execution** | **100% Native 64-bit Linux ELF** (Zero Wine / Zero Proton) | Windows `.exe` running under Wine / Proton DXVK | ⚠️ Limited / Unofficial workarounds | Native Linux `.deb` (Legacy, unmaintained) |
| **Old School RuneScape** | **Multi-Client Dock** (RuneLite, HDOS, Official) | Official OSRS / RuneLite inside Wine prefix | RuneLite & HDOS native | Official legacy client only |
| **RuneScape: Dragonwilds** | **Integrated Steam Launch** + Live Patch Feeds | ❌ Not supported | ❌ Not supported | ❌ Not supported |
| **Jagex Account Support** | **Full OAuth 2.0 PKCE + Turnstile Webview** | Full (via Windows Launcher in Wine) | Full (via Webview) | ❌ **Broken** (Only supports legacy usernames) |
| **Ubuntu 22.04 / 24.04 / 26.04 OpenSSL Fix** | **Isolated Userspace OpenSSL 1.1 Compat** (Zero host pollution) | N/A (runs Windows OpenSSL DLLs in Wine) | ❌ Manual user intervention required | ❌ Fails `apt install` (`libssl1.1` missing) |
| **Wayland & Audio Auto-Fixes** | **Built-in System Doctor** + automatic Wayland & PipeWire fixes | Relies on Wine Wayland / X11 bridging | ❌ Not provided | ❌ Freezes on "Loading application resources" |
| **Root Permissions Required?** | ❌ **Never** (100% rootless in userspace) | ❌ Flatpak sandbox | ❌ Rootless | ⚠️ Requires `sudo apt` / `dpkg` |
| **Steam Deck & SteamOS** | **Full Gamepad Navigation + OSK + Grid Art Generator** | Bulky Wine Flatpak; no native gamepad UI | Minimal handheld integration | ❌ No SteamOS support |
| **User Interface** | **Familiar desktop layout** + native Linux window controls | Official Windows UI (inside Wine window) | Custom utilitarian UI | No launcher interface |
| **Resource Overhead** | **Zero-RAM Mode** (Auto-closes 1.5s after launch) | Heavy (Launcher + Wine + CEF persists) | Moderate | N/A |
| **Integrated Auto-Updater** | **In-place AppImage hot-swap** + `.deb` downloader | Flatpak updates only | Manual / GitHub releases | ❌ Deprecated repository |

---

### 🔍 Deep-Dive: What This Launcher Does Differently

#### 1. Compared to TormStorm's Flatpak (`jagex-launcher-linux`)
* **Bare-Metal Native Performance vs. Wine/Proton Overhead:**  
  TormStorm's Flatpak packages the Windows `.exe` of the official Jagex Launcher inside a Wine prefix inside a Flatpak container. This means running a full Windows compatibility layer, Windows PE binaries, and executing RuneScape 3 through DXVK and Wine translation layers rather than native Vulkan/OpenGL. **PatchCraft Launcher runs official 64-bit Linux native ELF binaries directly against your Linux kernel, Mesa/NVIDIA drivers, and PipeWire/PulseAudio with zero emulation layer and zero translation penalty.**
* **Native Filesystem vs. Sandboxed Wine `drive_c`:**  
  Running RuneLite or other tools through Wine isolates their configuration files inside an emulated Windows `drive_c` sandbox. PatchCraft Launcher runs all clients natively against your standard user profile (`~/.runelite`, `~/.config`), so your existing plugins, tile markers, bank tags, screenshots, and custom configurations work immediately without moving files or setting Flatpak permission overrides.
* **Immunity to Wine CEF & Prefix Breakage:**  
  Updates to Jagex's Windows launcher frequently break the Chromium Embedded Framework (CEF) runtime inside Wine, leading to white screens, frozen login windows, or failed authentications whenever Jagex pushes launcher updates. PatchCraft Launcher uses a modern, native Linux Electron runtime that communicates cleanly with Jagex's OAuth endpoints and never suffers from Wine translation breakage.

#### 2. Compared to Bolt Launcher
* **First-Class Native RuneScape 3 Support:**  
  Bolt was built predominantly around Old School RuneScape and RuneLite. It does not provide automated rootless deployment for the native RS3 NXT client, does not solve the modern OpenSSL 1.1 dependency conflict on Ubuntu 22.04, 24.04, and 26.04 LTS, and lacks graphics and audio workarounds for modern Linux display servers.
* **The Complete Jagex Catalog in One Dock:**  
  PatchCraft Launcher supports all three titles in a single launcher interface: **RuneScape 3** (native ELF), **Old School RuneScape** (with an instant dropdown dock for RuneLite, HDOS, and the Official Client), and **RuneScape: Dragonwilds** (one-click Steam launch with live Steam RSS patch notes).
* **Familiar Desktop Layout:**  
  Ships with a familiar desktop game-launcher layout including promotional hero banners, live maintenance status notices, news carousels, character switching with active membership status resolution, and standard Linux window controls.
* **Steam Deck & Handheld Support:**  
  Includes an out-of-the-box HTML5 Gamepad API controller navigation engine (bumpers switch games, D-pad navigates, face buttons trigger actions), Gamescope 1280×800 touch layout, automatic Steam on-screen keyboard (OSK) triggering, and a built-in one-click Steam shortcut & grid artwork generator.

#### 3. Compared to Jagex's Official Legacy Client & Beta Workarounds
* **Solves the Mandatory Jagex Account Dead-End:**  
  Jagex's official native Linux client (`runescape-launcher` `.deb`) was abandoned before Jagex introduced mandatory Jagex Accounts. When Jagex mandated account migration, Linux players who upgraded were locked out because the legacy client only accepts legacy username/password credentials. **PatchCraft Launcher provides the missing link**, executing full OAuth 2.0 PKCE authentication with Cloudflare Turnstile bot verification and passing the secure session token directly to the native Linux client.
* **Solves the Ubuntu 22.04, 24.04 & 26.04 `libssl1.1` Mismatch Safely:**  
  Modern Linux distributions dropped `libssl1.1` in favor of OpenSSL 3.x (`libssl3` / `libssl3t64`). Attempting to install Jagex's official `.deb` package fails with unmet dependencies, and force-installing outdated Ubuntu 20.04 packages with `dpkg` risks corrupting host package managers during system updates. Our launcher provisions isolated OpenSSL 1.1 compatibility libraries exclusively in userspace without ever modifying host system libraries.
* **100% Rootless Installation:**  
  The official Jagex documentation demands `sudo apt install`. PatchCraft Launcher extracts, installs, updates, and runs the client entirely in userspace. You will never need to enter a root or `sudo` password.
* **Fixes the "Loading Application Resources" Freeze Out of the Box:**  
  The legacy client notoriously hangs on modern Linux desktops due to Wayland compositor conflicts, PipeWire audio starvation, and GTK2 input method locks. PatchCraft Launcher automatically configures the display server, input method, audio latency, and GPU compatibility settings required for smooth, crash-free launches.

---

## ✨ Key Features

### ⚡ RuneScape 3 (Native Linux NXT)
- **Native 64-Bit ELF Execution**: Launches Jagex's official compiled 64-bit Linux binary directly against your Linux kernel, Mesa/Vulkan drivers, and display server.
- **Rootless Auto-Deployment**: Downloads and unpacks Jagex's official Linux client directly into userspace. **Never requires `sudo` or root permissions**.
- **Isolated OpenSSL 1.1 Compat (Ubuntu 22.04, 24.04 & 26.04 Fix)**: Automatically provisions isolated OpenSSL 1.1 compatibility libraries in userspace. Completely resolves the modern OpenSSL 3 mismatch without touching host `apt` or risking package manager conflicts.
- **Wayland & "Loading Application Resources" Fixes**: Automatically bridges Wayland/X11 display, input method, and PipeWire/PulseAudio routing to prevent startup freezes, with an optional Vulkan-backed OpenGL compatibility override for NVIDIA GPUs.
- **System Compatibility Doctor**: Integrated pre-flight diagnostic tool in Settings that verifies graphics drivers, display servers, and runtime dependencies, providing copyable terminal commands and one-click fixes.
- **Hardware Acceleration**: Full native Vulkan and OpenGL rendering on AMD Radeon (RADV), Intel Arc/Iris, and NVIDIA proprietary drivers.
- **PipeWire & PulseAudio Integration**: Pre-configured audio routing to eliminate crackles, buffer underruns, or latency.
- **Live Maintenance Warnings**: Fetches real-time server status, game downtime warnings, and scheduled cold-update alerts directly from Jagex CDN feeds.
- **Performance Tweaks**: One-click integration with Feral GameMode (`gamemoderun`) and MangoHud.

<div align="center">
  <img src="docs/assets/screenshot-rs3.png" alt="RuneScape 3 View" width="800" style="border-radius: 8px; border: 1px solid rgba(229,179,82,0.25); margin: 12px 0;" />
</div>

---

### ⚔️ Old School RuneScape
- **Multi-Client Dock Dropdown**: Switch seamlessly between **RuneLite**, **HDOS**, and the **Official Client** right from the bottom dock.
- **RuneLite Integration**: Detects existing system installations or downloads the official launcher JAR automatically. Runs directly against your normal user profile, preserving all your `~/.runelite` plugins, tile markers, bank tags, screenshots, and browser links.
- **HDOS (High-Definition Open Source)**: Auto-downloads and verifies the latest HDOS launcher from official CDNs, passing your Jagex session ID for instant 2008-era HD graphics at 144Hz+.
- **Custom JVM & Memory Tuning**: Easily configure custom Java paths (Java 11/17/21), heap size parameters (e.g. `-Xmx2048m`), or custom client flags.

<div align="center">
  <img src="docs/assets/screenshot-osrs.png" alt="Old School RuneScape View" width="800" style="border-radius: 8px; border: 1px solid rgba(229,179,82,0.25); margin: 12px 0;" />
</div>

---

### 🐉 RuneScape: Dragonwilds
- **Steam Integration**: Seamless one-click launch via `steam://run/1374490` directly into Jagex's new open-world survival action RPG in Ashenfall.
- **Real-Time Steam RSS Feed**: Live event broadcasts, patch notes (1.0.0.4+), and community announcements fetched directly from Valve's official news feed for App ID `1374490`.
- **Streamlined Workflow**: Automatically hides character selection when on the Dragonwilds tab since character management is handled directly in-game.

<div align="center">
  <img src="docs/assets/screenshot-dragonwilds.png" alt="RuneScape: Dragonwilds View" width="800" style="border-radius: 8px; border: 1px solid rgba(229,179,82,0.25); margin: 12px 0;" />
</div>

---

### 🛡️ Jagex Account Security & Privacy
- **Direct OAuth 2.0 with PKCE**: Connects straight to `account.jagex.com`. The launcher never touches or logs your plain-text password.
- **Interactive Cloudflare Turnstile Verification**: Built-in compliant webview allows you to complete Turnstile checkboxes and 2FA challenges effortlessly.
- **100% Client-Side / Zero Telemetry**: No third-party servers, analytics, or tracking. Session credentials and profile data reside exclusively in local user config (`~/.config/patchcraft-launcher/`).

---

### 🚀 Gaming Enhancements & Older Linux Hardware Support
- **Performance Mode (Low-Spec / Older Hardware)**: Disables GPU-heavy CSS blurs, suppresses continuous animation loops, applies lightweight memory management, and optimizes GPU fill-rate for older Intel HD Graphics (2000–5500), legacy AMD GPUs, and non-composited window managers (XFCE, MATE, Openbox).
- **Mesa OpenGL Compatibility Profile Override**: Forces Mesa to expose OpenGL 4.5 in compatibility mode, resolving OpenGL initialization crashes on older Intel (Ivy Bridge, Haswell) and legacy AMD TeraScale GPUs when launching RuneScape 3.
- **Legacy DRI3/DRI2 Fallback**: Eliminates window stuttering, flickering, and startup lockups on classic Intel SNA X11 drivers.
- **Lightweight OSRS Heap Tuning**: When Low-Spec Mode is active, automatically caps RuneLite/HDOS memory heap to prevent swap thrashing and Linux Out-Of-Memory (OOM) killer terminations on 4GB–8GB RAM systems.
- **Zero RAM Mode ("Close on Launch")**: Automatically closes the launcher shortly after your game launches, freeing 100% of the launcher's memory (150–250MB RAM).
- **Hardware-Accelerated Launcher UI**: Ensures hardware-accelerated GPU rendering on Linux for older GPUs rather than falling back to slow CPU software rasterization.
- **System Tray Mode**: Minimize cleanly to the system tray to keep characters ready without cluttering your taskbar.
- **Official Linux Window Controls**: Minimize, resize, and close buttons on the top-left matching standard Ubuntu and GNOME conventions.

---

### 🌐 World Latency & Ping Prober (RS3 & OSRS)
- **High-Performance Parallel Prober**: Concurrently benchmarks ping latencies across all active RuneScape 3 (Worlds 1–141) and Old School RuneScape (Worlds 301–599) servers in ~1.2 seconds using parallel worker pools.
- **Header Quick Access & Dedicated Settings Cards**: Launch the prober directly via the Globe icon next to the Account Manager in the top header, or inspect game-specific world lists within **Settings > RuneScape 3** and **Settings > Old School RuneScape**.
- **Accurate In-Game World Mapping**: OSRS server subdomains (`oldschoolX`) automatically map to true in-game world numbers (`300 + X`, e.g., World 301, 302, 386) matching your in-game world select screen.
- **Regional Filtering & Visual Badges**: Filter worlds dynamically by US East/West, Europe/UK, Germany, or Australia with color-coded response times (Green `<50ms`, Amber `50–100ms`, Red `>100ms`).
- **Standalone Terminal Scripts**: Includes production-grade parallel CLI tools ([`docs/rs3-ping.sh`](docs/rs3-ping.sh) and [`docs/osrs-ping.sh`](docs/osrs-ping.sh)) executable directly from terminal or shell shortcuts without opening the GUI.

---

### 📚 Community Resources & Tools Hub
- **Dedicated Sidebar Access**: Launch the Hub via the **Resources** tab positioned right above Settings in the launcher navigation bar.
- **Smart Game Auto-Focus**: Automatically opens directly to whichever game is currently active (**RuneScape 3**, **Old School**, or **Dragonwilds**).
- **Curated Player-Centric Directory**: Includes one-click access to the official wikis, Alt1 Toolkit, PvM Encyclopedia (PvME), OSRS Wiki DPS Calculator, GE Tracker, Quest Helper, Wise Old Man, TempleOSRS, MapGenie Ashenfall Interactive Map, and community hubs.
- **Instant Live Search**: Real-time filtering by tool name, purpose, or category (e.g., search "dps", "map", "clue", or "prices").
- **Secure Native Browser Launch**: Safely opens all links in your default Linux browser through the launcher's sandboxed IPC bridge.

---

### 🔄 Integrated Auto Updater
- **Direct In-App AppImage Updates**: When running as an AppImage, queries GitHub Releases directly, downloads update binaries with real-time streaming progress, validates SHA256 checksums, and performs seamless in-place hot-swapping and restart.
- **Debian / Ubuntu (.deb) Downloader**: Automatically downloads updated `.deb` packages to `~/Downloads` and outputs copy-paste installation commands.
- **Distribution-Aware Notifications**: Respectfully detects Flatpak, Snap, RPM, and Arch Pacman environments, informing users when upstream package updates are available without conflicting with system package managers.
- **Startup Auto-Check & Version Management**: Configure automatic background checks in Settings -> General or check on-demand anytime, with support for skipping specific versions.

---

### 🎮 Steam Deck & SteamOS Handhelds
- **Automated Rootless Fast-Installer**: Run one command in Konsole without touching `steamos-readonly` or typing `sudo`.
- **1280×800 (16:10) Touch Scaling**: Scaled touch targets, Gamescope borderless optimization, and 800p height accommodations.
- **Full Gamepad / Controller Navigation**: Native HTML5 Gamepad API integration (Bumpers cycle games, D-Pad/stick navigates, `A` launches/selects, `B` backs out, `Y` switches character, `X` selects client, `Start` opens Settings).
- **Steam Virtual Keyboard (OSK)**: Auto-triggers `steam://open/keyboard` when text input boxes are focused in Gaming Mode.
- **Steam Library & Grid Artwork Generator**: Built-in utility in Settings to register the launcher in Steam's `shortcuts.vdf` with official high-res cover, hero, and banner art.

---

### 📌 Native System Tray & Quick Folders Hub
- **System Tray Mode**: Minimize cleanly to the system tray to keep characters ready without taskbar clutter. Right-click the tray icon to quickly launch active characters or restore the window.
- **Quick Shortcuts & Client Folders Hub**: One-click folder access in Settings for screenshots, logs, and game caches across **RuneLite** (`~/.runelite`), **RuneScape 3** (`~/.local/share/Jagex`), and **HDOS** (`~/.hdos`).
- **Desktop Shortcuts & Icon Re-Registration**: Built-in repair tool in Settings to re-generate standard FreeDesktop `.desktop` launchers and install multi-resolution system icons (`16x16` up to `1024x1024`) for the Launcher, RuneLite, HDOS, and the Official OSRS client.

---

## 📥 Installation

Download the latest release package from the **[GitHub Releases page](https://github.com/cook0001/Patchcraft-Launcher/releases)**.

### Option 1: Ubuntu / Linux Mint / Pop!_OS (Official Launchpad PPA)

The official Canonical Launchpad PPA provides native `.deb` packages built directly in Canonical's cloud infrastructure for **Ubuntu 26.04 LTS (`resolute`)**, **Ubuntu 24.04 LTS (`noble`)**, and **Ubuntu 22.04 LTS (`jammy`)** (as well as Linux Mint and Pop!_OS derivatives). System dependencies are resolved automatically, and updates are delivered seamlessly through standard `apt upgrade`:

**1. Add the PPA repository:**
```bash
sudo add-apt-repository ppa:danielcook2016/patchcraft-launcher
```

**2. Update package list and install:**
```bash
sudo apt update
```
```bash
sudo apt install -y patchcraft-launcher
```

**3. Launch:**
```bash
patchcraft-launcher
```

> **Note for Ubuntu 24.04 & 26.04 ("Resolute Raccoon") users:** If `apt update` fails with `NO_PUBKEY 7373B12CE03BEB4B` or `The repository 'https://content.runescape.com/downloads/ubuntu trusty InRelease' is not signed`, remove Jagex's deprecated Ubuntu 14.04 (`trusty`) repo left behind from Jagex's old website instructions—Linux Jagex Launcher does not use it:
> ```bash
> sudo rm -f /etc/apt/sources.list.d/runescape.list /etc/apt/sources.list.d/runescape.sources && sudo apt update
> ```

**To uninstall or remove the PPA:**
```bash
sudo apt remove patchcraft-launcher
```
```bash
sudo add-apt-repository --remove ppa:danielcook2016/patchcraft-launcher
```

---

### Option 2: Debian / Ubuntu / Linux Mint (Standalone `.deb`)

**One-Line Fast Install:**
```bash
curl -sSL https://launcher.patchcraft.dev/install.sh | bash
```

**Or manual install via `apt`:**
```bash
# Download latest .deb from Releases:
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/patchcraft-launcher_2.0.0_amd64.deb
```
```bash
# Install package (apt automatically pulls all required system libraries):
sudo apt install ./patchcraft-launcher_2.0.0_amd64.deb
```

---

### Option 3: Universal AppImage

Works on virtually any modern 64-bit Linux distribution (Ubuntu, Fedora, Arch, SteamOS, Debian, Mint):

```bash
# Download AppImage from Releases:
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/PatchCraft-Launcher-2.0.0.AppImage
```
```bash
# Make executable:
chmod +x PatchCraft-Launcher-2.0.0.AppImage
```
```bash
# Run:
./PatchCraft-Launcher-2.0.0.AppImage
```

---

### Option 4: Canonical Snap (`snapd`)

Official Snap package built with `core24` strict confinement, automated background updates, and persistent game data storage in `$SNAP_USER_COMMON`:

[![patchcraft-launcher](https://snapcraft.io/patchcraft-launcher/badge.svg)](https://snapcraft.io/patchcraft-launcher)

[![Get it from the Snap Store](https://snapcraft.io/en/dark/install.svg)](https://snapcraft.io/patchcraft-launcher)

**1. Install from Snap Store:**
```bash
sudo snap install patchcraft-launcher
```

**2. Optional permissions (controller & external storage):**
```bash
# Connect gamepad/joystick interface for handheld controllers and Steam Deck:
sudo snap connect patchcraft-launcher:joystick

# Connect removable media interface for micro-SD cards and external drives:
sudo snap connect patchcraft-launcher:removable-media
```

**3. Launch:**
```bash
patchcraft-launcher
```

---

### Option 5: Steam Deck & SteamOS (Automated Fast-Installer)

Installs 100% rootless in userspace without modifying read-only system partitions. Automatically registers as a Non-Steam Game with official high-res Steam Grid artwork:

In **Desktop Mode** (`Steam Button` &rarr; `Power` &rarr; `Switch to Desktop`), open **Konsole** and run:
```bash
curl -sSL https://launcher.patchcraft.dev/deck-install.sh | bash
```

Once complete, return to **Gaming Mode** and launch directly from your Non-Steam library with full physical controller/gamepad navigation!

---

### Option 6: Arch Linux / CachyOS / EndeavourOS / Manjaro (Signed Pacman Repo)

**1. Import and trust the PatchCraft signing key:**
```bash
curl -fsSL https://repo.patchcraft.dev/gpg.asc -o /tmp/patchcraft.asc && sudo pacman-key --add /tmp/patchcraft.asc && sudo pacman-key --lsign-key "$(gpg --show-keys --with-colons /tmp/patchcraft.asc | awk -F: '$1=="fpr"{print $10; exit}')" && rm -f /tmp/patchcraft.asc
```

**2. Add the `[patchcraft]` repository and install (automatic `pacman -Syu` updates):**
```bash
grep -q '^\[patchcraft\]' /etc/pacman.conf || printf '\n[patchcraft]\nServer = https://repo.patchcraft.dev/arch/$arch\n' | sudo tee -a /etc/pacman.conf
sudo pacman -Syu patchcraft-launcher
```

**Or install the standalone `.pacman` release package directly:**
```bash
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/patchcraft-launcher-2.0.0.x64.pacman
sudo pacman -U ./patchcraft-launcher-2.0.0.x64.pacman
```

---

### Option 7: Fedora / Nobara / RHEL / openSUSE (Signed RPM Repo)

**1. Add the signed PatchCraft repository and install (automatic `dnf upgrade` updates):**
```bash
sudo curl -fsSL https://repo.patchcraft.dev/rpm/patchcraft.repo -o /etc/yum.repos.d/patchcraft.repo
sudo dnf install -y patchcraft-launcher
```

**openSUSE Tumbleweed / Leap (`zypper`):**
```bash
sudo zypper ar -f https://repo.patchcraft.dev/rpm/patchcraft.repo && sudo zypper refresh && sudo zypper install -y patchcraft-launcher
```

**Or install the standalone `.rpm` release package directly:**
```bash
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/patchcraft-launcher-2.0.0.x86_64.rpm
sudo dnf install -y ./patchcraft-launcher-2.0.0.x86_64.rpm
```

---

### Option 8: Portable Tarball (`.tar.gz`) & SHA-256 Verification

Extract and run anywhere in userspace without installing system packages:

```bash
# 1. Download tarball and SHA256SUMS.txt from GitHub Releases:
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/patchcraft-launcher-2.0.0.tar.gz
curl -LO https://github.com/cook0001/Patchcraft-Launcher/releases/latest/download/SHA256SUMS.txt

# 2. Verify SHA-256 checksum integrity:
sha256sum -c SHA256SUMS.txt --ignore-missing

# 3. Extract and launch:
tar -xzf patchcraft-launcher-2.0.0.tar.gz
./patchcraft-launcher-2.0.0/patchcraft-launcher
```

---

## 🔧 Settings & Customization

Click the **Gear icon** in the bottom dock to access the unified Settings Modal:

| Tab | Options |
|---|---|
| **General** | Close on Launch (0 MB RAM mode), Minimize to System Tray, Feral GameMode (`gamemoderun`), MangoHud overlay. |
| **Old School RuneScape** | Default client selection (RuneLite / HDOS / Official), Custom Java binary path, Custom executable/JAR override, Custom JVM arguments (`-Xmx`), Custom client flags, Flatpak client auto-detection, One-click client verify/reinstall, Built-in OSRS World Latency & Ping prober. |
| **RuneScape 3** | Custom client binary override, Extra launch parameters, Mesa Threaded OpenGL performance boost, Force X11/XWayland, PulseAudio/PipeWire latency mitigation, Client cache verification, Built-in RS3 World Latency & Ping prober. |
| **Account Management** | Multi-account login and fast switching, individual character selection with active membership badges. |

---

## 🔍 How It Works

When you click **PLAY**:
1. The launcher retrieves your active character session obtained via direct OAuth 2.0 PKCE authentication with `account.jagex.com`.
2. The launcher configures and starts your selected game client:
   - **RuneScape 3**: Launches the native 64-bit Linux client with display server, audio, and GPU compatibility settings applied.
   - **Old School RuneScape (RuneLite / HDOS / Official)**: Passes your authenticated session cleanly to the selected client while preserving your standard home profile (`~/.runelite`).
   - **Dragonwilds**: Launches directly through Steam (`steam://run/1374490`).
3. If enabled, the launcher closes itself or minimizes to the system tray to save memory.

---

## ❓ FAQ & Troubleshooting

<details>
<summary><strong>Will I get banned for using this launcher?</strong></summary>

No. This launcher does not alter game binaries, manipulate memory, or inject cheat code. It authenticates directly with official Jagex OAuth 2.0 servers and hands the resulting session to unmodified official or community-approved game clients.
</details>

<details>
<summary><strong>Do my RuneLite plugins and bank tags stay saved?</strong></summary>

Yes! The launcher respects your system user profile. All configuration, plugins, screenshots, and tile markers in `~/.runelite` remain completely untouched.
</details>

<details>
<summary><strong>How does the native Linux RS3 client run without root?</strong></summary>

The launcher unpacks Jagex's official Linux package into local userspace storage, allowing it to install and update without ever requesting `sudo` or root permissions.
</details>

<details>
<summary><strong>AppImage won't open on Ubuntu 24.04 / 26.04 or Fedora?</strong></summary>

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
<summary><strong>How do I fix "NO_PUBKEY 7373B12CE03BEB4B" or "https://content.runescape.com/downloads/ubuntu trusty InRelease is not signed" on Ubuntu 24.04 / 26.04?</strong></summary>

Jagex's website still lists legacy installation commands targeting **Ubuntu 14.04 (`trusty`)** that pipe `runescape.gpg.key` into `sudo apt-key add -` and write `https://content.runescape.com/downloads/ubuntu` into `/etc/apt/sources.list.d/runescape.list`.

On **Ubuntu 24.04 LTS (`noble`)** and **Ubuntu 26.04 LTS ("Resolute Raccoon", `resolute`)**:
1. `apt-key` has been completely removed, leaving `runescape.list` without a trusted keyring (`NO_PUBKEY 7373B12CE03BEB4B`).
2. APT 3.x strictly rejects unsigned / legacy SHA-1-bound repositories (`The repository 'https://content.runescape.com/downloads/ubuntu trusty InRelease' is not signed`), causing **every** `sudo apt update` or `sudo add-apt-repository` command on your system to fail.
3. Even with a key, Jagex's `trusty` repository cannot be installed via `apt` on modern Ubuntu because its `.deb` hard-depends on removed `libssl1.1`.

**Linux Jagex Launcher never uses that APT repository**—it installs and manages the native RS3 client rootlessly in userspace. Remove the leftover Jagex APT source file:

```bash
sudo rm -f /etc/apt/sources.list.d/runescape.list /etc/apt/sources.list.d/runescape.sources /etc/apt/trusted.gpg.d/runescape.gpg /usr/share/keyrings/runescape.gpg
sudo apt update
```

*(Running our `install.sh` script or clicking **Remove Legacy Repo** inside **Settings > Run Diagnostics** also cleans this up automatically.)*
</details>

<details>
<summary><strong>How does this launcher resolve the libssl1.1 error on Ubuntu 22.04, 24.04 & 26.04?</strong></summary>

Modern Ubuntu versions (22.04 LTS and 24.04 LTS+) transitioned completely to OpenSSL 3 (`libssl3`) and dropped `libssl1.1`. The official native Jagex Linux client was built against `libssl1.1` and fails to start on clean modern installations.

**Never force-install outdated `libssl1.1` packages from Ubuntu 20.04 (Focal) into your host system package manager**, as this can corrupt `apt` during subsequent system upgrades.

**The Linux Jagex Launcher automatically solves this safely:**
1. It downloads and verifies isolated OpenSSL 1.1 compatibility libraries exclusively in userspace.
2. When launching the game, it scopes library resolution only to the game subprocess.
3. Your system's package manager (`apt`, `dnf`, `pacman`) remains 100% clean and untouched!
</details>

<details>
<summary><strong>Why does RuneScape 3 freeze on "Loading application resources" and how do I fix it?</strong></summary>

The "Loading application resources" hang is typically caused by:
1. **Wayland Compositor Conflicts**: The legacy client crashes or locks when interacting directly with modern Wayland compositors. **Fix**: Linux Jagex Launcher automatically applies the compatibility routing needed for modern Wayland and X11 desktops.
2. **Missing OpenGL/Vulkan Drivers**: Minimal desktop installs may lack required OpenGL or Vulkan libraries. Run **Settings > RuneScape 3 > Run Diagnostics** to check.
3. **Audio Buffer Underrun**: PulseAudio/PipeWire buffers underflowing during initial asset decompression can block the main thread. Linux Jagex Launcher automatically applies audio latency mitigation on launch.
4. **Corrupted Shader/Asset Cache**: Click **Settings > RuneScape 3 > Clear Cache** to wipe stale cache files from `~/.jagex_launcher` and force a clean reload.
5. **NVIDIA on Wayland**: Enable **Settings > RuneScape 3 > GPU Driver: Mesa Zink Override** to route OpenGL rendering over Vulkan.
</details>

<details>
<summary><strong>Can I play on Linux if I migrated to a Jagex Account?</strong></summary>

Yes! Characters migrated to Jagex Accounts can no longer authenticate using legacy in-client usernames/passwords. Linux Jagex Launcher performs the official OAuth 2.0 PKCE authentication flow directly with Jagex Auth servers, verifies Cloudflare Turnstile, and passes your authenticated session directly to the game client.
</details>

<details>
<summary><strong>Why should I never run the launcher with sudo or root?</strong></summary>

Running the launcher with `sudo` will cause files in `~/.local/share`, `~/.config`, `~/.runelite`, and `~/.jagex_launcher` to be written with `root:root` ownership. Subsequently launching as a normal user will result in permission denied crashes, failed client updates, or corrupted settings. Always run the launcher as your standard desktop user.
</details>

---

## 💬 Community Feedback

Have feature suggestions, UI thoughts, performance reports, or distro compatibility feedback? Join the conversation on [GitHub Discussions](https://github.com/cook0001/Patchcraft-Launcher/discussions), submit directly at [launcher.patchcraft.dev/#feedback](https://launcher.patchcraft.dev/#feedback), or fill out our [Community Feedback Survey](https://forms.gle/KvagBxcmVBB3Q721A).

PatchCraft Launcher is 100% free with no paywalled features. If you'd like to help cover hosting (`patchcraft.dev`) and ongoing Linux/Steam Deck maintenance, optional tips are welcome on [Ko-fi](https://ko-fi.com/patchcraft).

---

## 🐛 Bug Reports & Feature Requests

Encountered a distribution-specific quirk or want to suggest a feature? Open an issue on [GitHub Issues](https://github.com/cook0001/Patchcraft-Launcher/issues) or use **Settings → Report Issue** inside the launcher to generate a sanitized system diagnostic summary automatically.

---

## 📄 License & Legal Notice

This software is proprietary software licensed under the [Proprietary Software License and Terms of Service](LICENSE). All rights reserved. Unauthorized copying, modification, redistribution, or reverse engineering of this software is strictly prohibited.

**Trademark Disclaimer:**  
*RuneScape*, *Old School RuneScape*, and *Jagex* are registered trademarks of Jagex Limited in the United Kingdom, United States, and other countries. This software is an independent freeware project and is not affiliated with, endorsed by, sponsored by, or associated with Jagex Limited. All game titles, screenshots, and trademarks belong to their respective owners.
