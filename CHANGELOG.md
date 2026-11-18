# Changelog

All notable changes to the **Linux Jagex Launcher** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-11-14

### Added
- **Website News & Release Feed**: Added an interactive Updates & News section to the project website with JSON/RSS feeds and automated release synchronization.

### Fixed
- **Live Client Logger & Diagnostics**: Fixed live log line rendering, replaced silent error catches with structured diagnostics, and removed startup timer workarounds across window initialization and deep-link handling.

### Changed
- **Launcher Architecture & Modularity**: Refactored UI controllers (Auto Updater, RS3/OSRS Doctor diagnostics, and Tools hub) into focused modules and consolidated process lifecycle monitoring, icon deployment, and streaming downloads.
- **Community**: Added Code of Conduct, refreshed issue/PR templates, and synced public community files.

### Notes
- **Thanks for your patience**: Sorry for the radio silence — I recently lost power and internet access for a few days. My sincerest apologies for the delay in response. Between v1.4.8 (targeted bug fixes), v1.4.9 (general fixes), and v1.5.0 (major codebase reorganization and backend improvements), development continues smoothly. Huge thanks to everyone using the launcher!

---

## [1.4.9] - 2026-11-13

### Fixed
- Resolve root-cause bugs across auth, launcher, updater, diagnostics, and renderer

### Changed
- **Dependencies**: Resolve minimatch Dependabot alert, update Electron/Vite/Oxlint, and bump Flatpak runtime to 26.08

---

## [1.4.8] - 2026-11-12

### Added
- **Legacy Jagex APT Repository Detection & One-Click Remediation**: Added automatic detection and guided one-click cleanup for Jagex's deprecated Ubuntu 14.04 (`trusty`) APT repository, resolving signature and `NO_PUBKEY` APT update errors on Ubuntu 24.04 LTS and Ubuntu 26.04 LTS ("Resolute Raccoon") in RS3 Doctor, OSRS Doctor, Issue Reporter, and `install.sh`.

### Fixed
- **Ubuntu 24.04 & 26.04 (`resolute`) `t64` Package Resolution**: Updated RS3 Doctor, OSRS Doctor, and Debian repository metadata to resolve modern 64-bit `time_t` (`t64`) library packages on Ubuntu 24.04+, Ubuntu 26.04 LTS, Linux Mint 22+, Pop!_OS 24.04+, and Debian 13+, while retaining compatibility on Ubuntu 22.04 and Debian 12.
- **RS3 CDN Diagnostic Probe & OSRS Repair Fixes**: Updated the RS3 network diagnostic probe to check the active client package index and fixed home-directory path expansion in OSRS permissions repair.
- **Standalone Debian Installer Resiliency (`install.sh`)**: Prevented broken third-party APT repositories from aborting local `.deb` package installation and enabled fast HTTP error detection on release downloads.
- **Official Website UI, Responsive Layout & Accessibility Overhaul**: Removed the redundant macOS traffic-light titlebar stacked above the launcher's native Linux window frame, added a responsive mobile navigation popover menu, implemented accessible installation tabs with find-in-page auto-switching and scroll-edge fades, fixed code-block horizontal overflow and copy-button race conditions, corrected the Fedora Copr repository command (`cook0001/linux-jagex-launcher`), and added explicit image dimensions + LCP priority hints to eliminate layout shift.

---

## [1.4.7] - 2026-10-06

### Added
- **RuneScape API Plugins Beta Support (World 204)**: Added first-class integration for the official RuneScape Lua API Plugins Beta, including deep-link protocol support, dynamic environment switching between Live NXT and API Beta directly on the launch dock, and one-click configuration presets in RS3 settings.

### Changed
- **Codebase Optimization & Performance Refinement**: Consolidated internal system helpers, simplified encoding paths, and optimized cache inspection and diagnostic distro checks.
- **Documentation & UI Parity**: Cleaned shell script output formatting across Steam Deck and standalone installers and updated distribution specifications across all packaging formats.

## [1.4.6] - 2026-10-04

### Added
- **Cache Size Inspector**: Live disk usage calculation and selective safe cache clearing across RuneScape 3 NXT, RuneLite, HDOS, and launcher application logs with confirmation safeguards.
- **In-App Issue Reporter & Diagnostics**: Built-in system environment collector and issue generator with sanitized hardware/distro diagnostics, pre-filled GitHub issue templates, and 4-point in-app discoverability (sidebar rail "Issues" button, General Settings hub, RS3 diagnostics card, and OSRS diagnostics card).
- **Automated Security & Quality Checks**: Added automated vulnerability scanning, Flatpak manifest linting, dependency updates, and documentation link checks.

### Fixed
- **Character Membership Detection**: Corrected Jagex Account character membership status evaluation and badge indicators in profile cards and quick switcher.
- **Release Parity**: Synchronized all distribution specifications (AppImage, Flatpak, Snap, Debian PPA, Fedora RPM/Copr, Arch AUR/Pacman, and Steam Deck turnkey installer) to v1.4.6.

---

## [1.4.5] - 2026-10-02

### Added
- **In-Place Atomic Auto-Updater**: Overhauled auto-updater engine with safe atomic file replacement, SHA-256 integrity verification, permission preservation, and live in-app download progress.
- **Automated Snapcraft Publishing**: Added automated CI deployment for Canonical Snap Store publishing targeting `core24`.

### Changed
- Refactored updater UI modal with distinct distribution format detection and package-specific update instructions.

---

## [1.4.4] - 2026-10-01

### Fixed
- **Debian & PPA Package Relationships**: Declared explicit `Replaces`, `Conflicts`, and `Provides` relationships between `jagex-launcher` and `linux-jagex-launcher`, resolving dpkg file overwrite and upgrade collisions.
- **AUR Binary Execution & Symlink Paths**: Corrected target binary installation path in the AUR package and added symlinks in `/usr/bin` for both `linux-jagex-launcher` and `jagex-launcher` for immediate command-line execution.
- **Launchpad PPA Version Synchronization**: Bumped upstream release version to v1.4.4 to generate clean Debian source artifacts and resolve Launchpad PPA checksum conflicts.

## [1.4.3] - 2026-10-01

### Added
- **HiDPI Display Scaling Controls for OSRS**: Configurable UI scaling (`1.0x` to `3.0x`) for crisp high-resolution rendering on 4K, 1440p, and high-density laptop displays.
- **Multi-Instance Client Manager**: Live tracking and management for multiple concurrent RuneLite, HDOS, and RS3 game clients with live process heartbeats and individual force-stop/kill controls.
- **In-App Live Client Log Viewer**: Dedicated real-time terminal modal with ring-buffered streaming, level coloring, log source filters, token sanitization, and text export.
- **Multi-GPU & Dedicated GPU Selector**: Automatic hardware detection of integrated and discrete GPUs with one-click Mesa and NVIDIA PRIME GPU offloading.
- **Deep Link OAuth Protocol Handling**: Seamless authentication callback interception for `jagex://` and `jagex-launcher://` URLs on running instances and cold start.

### Fixed
- **Custom Launch Command Template Expansion**: Fixed quoted argument tokenization in `%command%` launch wrappers for tools like `gamemoderun`, `mangohud`, and `gamescope`.
- **Process Lifecycle & PID Recycling Safeguards**: Added strict process identity checks before signaling child processes and safely pruned exited instances.
- **Harmless Desktop Warning Classification**: Automatically categorized non-fatal desktop subsystem notices (`canberra-gtk-module`, `pk-gtk-module`, `ALSA`, `LWJGL`, `WARNING:`) as warnings rather than red errors.
- **Network Resilience Timeouts**: Added request timeouts across authentication, update checking, and client download operations to prevent UI hangs on stalled connections.
- **Steam Shortcut Key Indexing**: Fixed sequential key generation in `shortcuts.vdf` to prevent key collisions with existing non-Steam shortcuts.
- **Release Parity**: Synchronized all packaging formats across AppImage, Flatpak, Snap, Debian PPA, and AUR to v1.4.3.

## [1.4.2] - 2026-09-30

### Fixed
- **AppImage Child Environment Isolation & RuneLite Launch Loop**: Isolated AppImage runtime variables when launching game clients so RuneLite no longer misidentifies the launcher AppImage as its own bundle and exits early.
- **RuneLite & OSRS Process Lifecycle Tracking**: Improved process tracking across launcher-to-client handoff so game-running status persists smoothly after the bootstrap jar exits.
- **OpenJDK 24+ ZGC Compatibility**: Automatically adjusts ZGC flags on OpenJDK 24+ where generational ZGC is enabled by default.
- **AppImage FUSE2-Free Static Runtime**: Switched to a static AppImage runtime to run seamlessly on Ubuntu 24.04 and 26.04 without requiring legacy `libfuse.so.2`.
- **Application Menu Launching & Stale Desktop Override Resolution**: Resolved working-directory assumptions when creating `.desktop` entries and cleaned up stale user desktop overrides that shadowed system binaries.
- **Single-Instance Lock & Window Focus**: Enforced single-instance locking so re-opening the launcher from the application menu restores and focuses the existing window instead of spawning duplicates.
- **Wayland Window Presentation & Compatibility**: Added secondary window presentation fallbacks and display surface compatibility tuning across Wayland and X11 compositors.
- **Application Menu Category Conformance**: Corrected desktop entry categories to standard `Game;` ensuring consistent placement across GNOME, KDE Plasma, and XFCE application menus.

### Added
- **Canonical Snap Release Pipeline**: Added full Snap package build and distribution support targeting `core24` with strict confinement, full hardware/audio/storage plugs, and persistent data storage across snap auto-refreshes.
- **In-App Snap Format Detection**: Added native Snap package recognition to the auto-updater and runtime directory layout.

---

## [1.4.1] - 2026-09-30

### Fixed
- **Ubuntu 24.04 (noble) and 26.04 (resolute) `t64` Dependency Resolution**: Updated Debian package dependencies with `t64` transitional alternatives for seamless `apt` installation on modern Ubuntu releases.
- **Debian Packaging Rules**: Updated Debian packaging rules to skip scanning pre-compiled Electron binaries during Launchpad PPA cloud builds.
- **Asynchronous OSRS Network Diagnostics**: Hardened background diagnostic probes against unhandled timeout rejections during network drops.

### Changed
- **PPA Source Package Build Resiliency**: Added automatic retry and cooldown handling for Launchpad PPA multi-series uploads.
- **Website Organization & Visual Polish**: Re-architected the project website with centered block containers, comfortable side padding, left-aligned typography, official game crests, and anonymous screenshots.

---

## [1.4.0] - 2026-09-30

### Added
- **Native Linux System Tray Support**: Added system tray integration with right-click context menu, fast character launch shortcuts, background minimize toggle, and persistent tray status.
- **Quick Shortcuts & Client Folders Hub**: Added quick-open shortcuts in Settings to easily locate screenshots, logs, and game caches for RuneLite (`~/.runelite`), RuneScape 3 (`~/.local/share/Jagex`), and HDOS (`~/.hdos`).
- **Desktop Shortcuts & Icon Re-Registration**: Added utility button in Settings to safely recreate or repair `.desktop` application launchers and multi-resolution icons (`16x16` up to `1024x1024`) for Linux Jagex Launcher, RuneLite, HDOS, and the Official OSRS client.
- **Official Launchpad Ubuntu PPA**: Full support for Ubuntu 26.04 LTS (`resolute`), Ubuntu 24.04 LTS (`noble`), and Ubuntu 22.04 LTS (`jammy`) via `ppa:danielcook2016/linux-jagex-launcher` with automated Launchpad cloud builds.
- **Bit-for-Bit Reproducible Source Packaging**: Added deterministic Debian source package generation and automated GPG signing for PPA releases.
- **Flathub & AppStream Compliance**: Updated AppStream metainfo specification to satisfy 100% of Flathub Quality Guidelines with zero validation warnings.

### Changed
- Re-architected Debian packaging rules to install dual desktop entries and multi-resolution application icons.
- Updated automated updater to handle in-place AppImage updates with SHA-256 verification and distribution-aware notifications.

---

## [1.3.0] - 2026-09-28

### Added
- **World Latency & Ping Prober**: Concurrently probes active RuneScape 3 (Worlds 1–141) and Old School RuneScape (Worlds 301–599) servers in ~1.2 seconds with regional filtering and color-coded latency badges.
- **Standalone Ping CLI Tools**: Added parallel Bash scripts (`rs3-ping.sh` and `osrs-ping.sh`) for headless terminal benchmarking.
- **Community Resources & Tools Directory**: Built-in player tool hub supporting RuneScape 3, Old School RuneScape, and RuneScape: Dragonwilds (including RuneKit, Alt1, PvME, and GE Tracker).
- **Older Linux Hardware & Low-Spec Performance Mode**: GPU optimization mode disabling heavy visual blurs and continuous animations, forcing hardware acceleration on older GPUs, and optimizing OSRS memory limits on low-RAM systems.
- **Mesa Compatibility & DRI Fallback**: Integrated settings toggles for OpenGL compatibility mode and legacy DRI driver fallbacks.

---

## [1.2.0] - 2026-09-28

### Added
- **Steam Deck Turnkey Installer**: One-line Konsole installation script (`deck-install.sh`) with rootless execution.
- **Steam Shortcuts & Grid Art Registration**: Automated registration in Steam's `shortcuts.vdf` with official high-resolution grid, hero, logo, and cover art.
- **Multi-Account Profile Switcher**: Fast switching dock supporting multiple saved Jagex Accounts with active character selection and membership status badges.
- **Mesa Threaded OpenGL**: One-click toggle for threaded OpenGL rendering to maximize RS3 NXT frame rates on AMD and Intel Mesa drivers.

---

## [1.1.0] - 2026-09-28

### Added
- **Steam Deck & Handheld Support**: Full HTML5 Gamepad API controller navigation (bumpers, D-pad, face buttons), 1280×800 touch scaling, and Steam On-Screen Keyboard (OSK) invocation.
- **Integrated Auto-Updater**: In-app release checking, streaming download progress, and format detection.
- **RuneScape: Dragonwilds Support**: Integrated Steam launch protocol (`steam://run/1374490`) and live Steam RSS patch feeds.
- **RS3 Diagnostic Engine**: Automated diagnostic checker verifying graphics drivers, XWayland compatibility, userspace OpenSSL 1.1 compatibility libraries, and audio routing.

---

## [1.0.0] - 2026-09-28

### Added
- **Initial Stable Release**: Native 64-bit Linux execution of RuneScape 3 NXT with zero Wine/Proton overhead.
- **Multi-Client Dock for OSRS**: Seamless switching between RuneLite, HDOS, and the Official OSRS client.
- **Jagex Account Authentication**: Full OAuth 2.0 PKCE authentication with Cloudflare Turnstile webview support.
- **Isolated OpenSSL 1.1 Compatibility**: Userspace `libssl1.1` provisioning resolving Ubuntu 22.04 and 24.04 library mismatches.
- **Zero-RAM Mode**: Auto-closing launcher 1.5 seconds after game launch.
