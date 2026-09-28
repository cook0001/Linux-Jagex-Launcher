# Contributing to Linux Jagex Launcher

First off, thank you for considering contributing to the **Linux Jagex Launcher**! It's people like you who make gaming on Linux awesome.

---

## 🛠️ Development Setup

### Requirements
- **Node.js**: v18 or later (v20 LTS recommended)
- **npm**: v9 or later
- **Linux utilities**: `tar`, `xz` or `libarchive-tools`
- Standard Linux libraries for running Electron

### Steps
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/Linux-Jagex-Launcher.git
   cd Linux-Jagex-Launcher
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run dev
   ```
4. Run TypeScript checks and production build:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
5. Package Linux binaries locally (AppImage, deb, tar.gz):
   ```bash
   npm run dist
   ```

---

## 📐 Project Structure

```
├── src/
│   ├── main/                 # Electron main process (Node.js runtime)
│   │   ├── index.ts          # Window lifecycle & app startup
│   │   ├── auth.ts           # OAuth 2.0 PKCE flow & Turnstile bypass
│   │   ├── store.ts          # Local persistent settings & token cache
│   │   ├── rs3.ts            # Native RS3 client download, verify, & launch
│   │   ├── osrs.ts           # OSRS (RuneLite, HDOS, Official) management
│   │   ├── news.ts           # Official Jagex news feed sync
│   │   └── preload.ts        # IPC bridge between main and renderer
│   └── renderer/             # Webview frontend (Vite + TypeScript + CSS)
│       ├── index.html        # Main launcher UI shell
│       ├── styles/           # Modern Jagex design system CSS
│       └── scripts/          # Client-side UI logic and animations
├── docs/                     # GitHub Pages showcase website
└── .github/                  # CI/CD workflows and issue templates
```

---

## 💡 Code Guidelines

- **Zero External Telemetry**: Do not introduce any analytics, tracking, or intermediary servers. The launcher must communicate solely with official Jagex endpoints and client CDNs.
- **Authentic Aesthetics**: Keep UI changes strictly aligned with the authentic Jagex Launcher look and feel.
- **Safety**: Do not tamper with official game binaries or provide any unfair game advantages.
- **Clean Commits**: Write clear, descriptive commit messages describing the *why* and *what*.

---

## 🚀 Submitting a Pull Request

1. Create a branch: `git checkout -b feature/my-new-feature`
2. Commit your changes: `git commit -am 'Add some feature'`
3. Push to your fork: `git push origin feature/my-new-feature`
4. Open a Pull Request on GitHub against `main`.
