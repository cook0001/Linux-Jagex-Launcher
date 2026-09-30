# Changelog

All notable changes to the **Linux Jagex Launcher** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2026-09-30

### Fixed
- **Ubuntu 24.04 (noble) and 26.04 (resolute) t64 Dependency Resolution**: Updated package dependencies in `electron-builder.json` and `packaging/ppa/debian/control` with transitional alternatives (`libatspi2.0-0t64 | libatspi2.0-0 | libatspi-0`, `libgtk-3-0 | libgtk-3-0t64`, `libasound2 | libasound2t64`, and added `xz-utils`, `xdg-utils`, `libxtst6`, `libgbm1`, `libdrm2`) ensuring seamless apt installation without broken package errors.
- **Debian Rules Shared Library Scanning**: Configured `override_dh_shlibdeps` in `packaging/ppa/debian/rules` to bypass scanning pre-compiled Electron binaries, resolving Launchpad builder failures.
- **Asynchronous OSRS Network Diagnostics**: Wrapped background socket and ping diagnostic probes in `src/main/osrs-diagnostics.ts` to prevent unhandled timeout rejections during network drops.

### Changed
- **PPA Source Package Build Resiliency**: Added automatic 4-attempt retry loop (`RETRY_DELAY=30`) and a 30-second cooldown (`sleep 30`) between series uploads in `packaging/ppa/build-source-package.sh` and `.github/workflows/ppa.yml` to prevent Launchpad rate-limiting.
- **Website Organization & Visual Polish**: Re-architected `docs/index.html` and `docs/style.css` with centered block containers, comfortable side padding, left-aligned typography, official game crests, and anonymous screenshots.

---

## [1.4.0] - 2026-09-30

### Added
- **Native Linux System Tray Support**: Added system tray integration with right-click context menu, fast character launch shortcuts, background minimize toggle, and persistent tray status.
- **Quick Shortcuts & Client Folders Hub**: Added quick-open shortcuts in Settings to easily locate screenshots, logs, and game caches for RuneLite (`~/.runelite`), RuneScape 3 (`~/.local/share/Jagex`), and HDOS (`~/.hdos`).
- **Desktop Shortcuts & Icon Re-Registration**: Added utility button in Settings to safely recreate or repair `.desktop` application launchers and multi-resolution icons (`16x16` up to `1024x1024`) for Linux Jagex Launcher, RuneLite, HDOS, and the Official OSRS client.
- **Official Launchpad Ubuntu PPA**: Full support for Ubuntu 26.04 LTS (`resolute`), Ubuntu 24.04 LTS (`noble`), and Ubuntu 22.04 LTS (`jammy`) via `ppa:danielcook2016/linux-jagex-launcher` with automated Launchpad cloud builds.
- **Bit-for-Bit Reproducible Source Packaging**: Added deterministic Debian source package generator (`packaging/ppa/build-source-package.sh`) with strict Debian 3.0 (quilt) formatting and automated GPG signing wrapper.
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
- **Older Linux Hardware & Low-Spec Performance Mode**: GPU optimization mode disabling heavy CSS blurs and continuous animations, forcing Mesa hardware acceleration on older GPUs, and capping OSRS heap memory at 768MB.
- **Mesa Compatibility & DRI Fallback**: Integrated settings toggles for `MESA_GL_VERSION_OVERRIDE=4.5COMPAT` and `LIBGL_DRI3_DISABLE=1`.

---

## [1.2.0] - 2026-09-28

### Added
- **Steam Deck Turnkey Installer**: One-line Konsole installation script (`deck-install.sh`) with rootless execution.
- **Steam Shortcuts & Grid Art Registration**: Automated registration in Steam's `shortcuts.vdf` with official high-resolution grid, hero, logo, and cover art.
- **Multi-Account Profile Switcher**: Fast switching dock supporting multiple saved Jagex Accounts with active character selection and membership status badges.
- **Mesa Threaded OpenGL**: One-click toggle for `mesa_glthread=true` to maximize RS3 NXT frame rates on AMD and Intel Mesa drivers.

---

## [1.1.0] - 2026-09-28

### Added
- **Steam Deck & Handheld Support**: Full HTML5 Gamepad API controller navigation (bumpers, D-pad, face buttons), 1280×800 touch scaling, and Steam On-Screen Keyboard (OSK) invocation.
- **Integrated Auto-Updater**: In-app release checking, streaming download progress, and format detection.
- **RuneScape: Dragonwilds Support**: Integrated Steam launch protocol (`steam://run/1374490`) and live Steam RSS patch feeds.
- **Rs3Doctor Diagnostic Engine**: Automated diagnostic checker verifying graphics drivers, XWayland compatibility, OpenSSL 1.1 userspace libraries, and audio routing.

---

## [1.0.0] - 2026-09-28

### Added
- **Initial Stable Release**: Native 64-bit Linux execution of RuneScape 3 NXT with zero Wine/Proton overhead.
- **Multi-Client Dock for OSRS**: Seamless switching between RuneLite, HDOS, and the Official OSRS client.
- **Jagex Account Authentication**: Full OAuth 2.0 PKCE authentication with Cloudflare Turnstile webview support.
- **Isolated OpenSSL 1.1 Compatibility**: Userspace `libssl1.1` provisioning resolving Ubuntu 22.04 and 24.04 library mismatches.
- **Zero-RAM Mode**: Auto-closing launcher 1.5 seconds after game launch.
