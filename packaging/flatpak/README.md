# 📦 Complete Flathub Submission & Packaging Guide

This guide provides a comprehensive walkthrough for packaging, testing, and submitting **Linux Jagex Launcher** (`io.github.cook0001.LinuxJagexLauncher`) to [Flathub](https://flathub.org).

Official Flathub Documentation Reference: [https://docs.flathub.org/docs/for-app-authors/submission](https://docs.flathub.org/docs/for-app-authors/submission)

---

## 📑 Table of Contents

1. [Submission Requirements & Quality Checklist](#1-submission-requirements--quality-checklist)
2. [Screenshots & Visual Assets Specification](#2-screenshots--visual-assets-specification)
3. [Screen Recording Guide (Capturing App Demos)](#3-screen-recording-guide-capturing-app-demos)
4. [Critical Flathub Policies (Generative AI & EOL Software)](#4-critical-flathub-policies)
5. [Local Testing with Flatpak & Linters](#5-local-testing-with-flatpak--linters)
6. [Step-by-Step Flathub Pull Request Submission](#6-step-by-step-flathub-pull-request-submission)
7. [Review, Test Builds & Developer Verification](#7-review-test-builds--developer-verification)

---

## 1. Submission Requirements & Quality Checklist

Flathub reviewers enforce strict metadata and quality standards before an application is approved:

| Item | Requirement | Linux Jagex Launcher Status |
|:---|:---|:---|
| **Application ID** | Reverse-DNS format with at least 4 components matching GitHub repo: `io.github.cook0001.LinuxJagexLauncher` | ✅ Configured across desktop, metainfo, and manifest |
| **AppStream MetaInfo** | Must pass `appstreamcli validate` without fatal errors or warnings | ✅ Validated: 0 errors, 0 warnings |
| **App Name** | Concise, under 20 characters, no marketing slogans (`Linux Jagex Launcher`) | ✅ Exactly 20 characters |
| **App Summary** | Sentence case, imperative, no period, between 10 and 35 characters | ✅ `Play RuneScape games natively` (30 chars) |
| **Brand Colors** | Light and dark primary hex colors for banner styling | ✅ Light: `#e5b352`, Dark: `#161c28` |
| **Icon** | Square PNG >= 256x256 or SVG, good contrast, no baked-in drop shadows | ✅ Master icon 512x512 and 1024x1024 available |
| **License** | Metadata license CC0-1.0 / FSFAP; Project license MIT | ✅ Declared in metainfo.xml |
| **OARS Content Rating** | Valid Open Age Rating Service tag (`oars-1.1`) | ✅ Configured |

---

## 2. Screenshots & Visual Assets Specification

Flathub requires screenshots to be hosted on public HTTPS URLs and referenced in `io.github.cook0001.LinuxJagexLauncher.metainfo.xml`.

### Guidelines for Compliant Screenshots:
- **Aspect Ratio & Resolution:** 16:9 or 3:2 aspect ratio, window resolution of 1080x720 (within the recommended <= 1000x700 or 2000x1400 HiDPI).
- **Window Framing:** Capture **just the application window** with its native window decorations, rounded corners, and drop shadow. Do not maximize the window and do not capture the full desktop wallpaper.
- **No Overlays:** No added promo text, watermark logos, or phone/laptop device mockups.
- **Captions:** Exactly one sentence, sentence case, no ending period, does not begin with numbers.

### Pre-Configured Live Screenshots:
The following screenshots are hosted on GitHub Pages and referenced in [`packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.metainfo.xml`](file:///home/daniel-cook/Documents/Linux-Jagex-Launcher/packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.metainfo.xml):

| Preview | Image URL | Caption (xml:lang="en") | Dimensions |
|:---|:---|:---|:---|
| **RuneScape 3 Tab** | `https://cook0001.github.io/Linux-Jagex-Launcher/assets/screenshot-rs3.png` | `RuneScape 3 running natively on Linux` | 1080x720 PNG |
| **Old School Tab** | `https://cook0001.github.io/Linux-Jagex-Launcher/assets/screenshot-osrs.png` | `Old School RuneScape view with RuneLite and HDOS client selection` | 1080x720 PNG |
| **Dragonwilds Tab** | `https://cook0001.github.io/Linux-Jagex-Launcher/assets/screenshot-dragonwilds.png` | `RuneScape: Dragonwilds integration` | 1080x720 PNG |
| **Store Banner** | `https://cook0001.github.io/Linux-Jagex-Launcher/assets/banner.png` | Promotional store banner | 1440x810 PNG |

---

## 3. Screen Recording Guide (Capturing App Demos)

While Flathub store pages display PNG screenshots from AppStream, video demonstrations are valuable for GitHub Release attachments, community showcases, and Flathub PR review walkthroughs.

### Method A: Built-in GNOME Screen Recorder (Fastest)
1. Press `Ctrl` + `Alt` + `Shift` + `R` (or press `PrintScreen` and click the **Video camera** icon).
2. Select the **Window** option and click the Linux Jagex Launcher window.
3. Click the red record button. Perform actions (switch between RS3 and OSRS tabs, open Settings, test World Ping).
4. Stop recording by clicking the red timer icon in the top GNOME panel. The WebM video is saved to `~/Videos/Screencasts/`.

### Method B: High-Quality WebM via `ffmpeg` (Command Line)
To record a crisp 60fps video of a specific display or window:
```bash
# Record primary display at 60 FPS:
ffmpeg -f x11grab -video_size 1920x1080 -framerate 60 -i :0.0 -c:v libvpx-vp9 -crf 28 -b:v 0 jagex-launcher-demo.webm
```

---

## 4. Critical Flathub Policies

Flathub maintains strict policies documented at [docs.flathub.org/docs/for-app-authors/requirements](https://docs.flathub.org/docs/for-app-authors/requirements):

### 4.1 Generative AI Policy (MANDATORY)
> *"AI tools or agents must not open or automate Flathub submission pull requests, or generate their commit messages, descriptions, review comments, or replies. Submitters must not request AI-agent reviews."*

- **Human Author Requirement:** You (the developer) must manually submit the pull request on GitHub, write your own PR description, and answer reviewer questions in your own words.
- **Do not automate the submission via bots or scripts.**

### 4.2 End-of-Life Dependency Policy
Flathub restricts unmaintained software (such as OpenSSL 1.x) if combined with broad network permissions. The RS3 NXT client was built for Ubuntu 14.04/16.04 and links against `libssl.so.1.1`. To comply with Flathub standards:
- The launcher isolates compatibility libraries directly inside `/app/lib/compat` or via `openssl-1.1.1w` build options so the rest of the runtime uses modern OpenSSL 3.

---

## 5. Local Testing with Flatpak & Linters

Ensure `flatpak` and `appstreamcli` are installed:

```bash
# 1. Validate AppStream MetaInfo locally
appstreamcli validate packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.metainfo.xml

# 2. Validate Desktop Entry file
desktop-file-validate packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.desktop

# 3. Install Flatpak Builder (if testing local compilation)
flatpak install -y flathub org.flatpak.Builder org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 org.freedesktop.Sdk.Extension.openjdk21//24.08

# 4. Run Flathub manifest linter
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.yml
```

---

## 6. Step-by-Step Flathub Pull Request Submission

Follow these exact steps to submit to the official Flathub repository:

### Step 1: Fork `flathub/flathub`
1. Go to [https://github.com/flathub/flathub](https://github.com/flathub/flathub).
2. Click **Fork**.
3. ⚠️ **IMPORTANT:** Uncheck *"Copy the master branch only"* so all branches (including `new-pr`) are copied to your fork.

### Step 2: Clone and Create Branch off `new-pr`
In your Linux terminal:
```bash
# Clone your fork
git clone https://github.com/cook0001/flathub.git
cd flathub

# Check out the new-pr branch (NEVER branch off master!)
git checkout --track origin/new-pr
git checkout -b add-io-github-cook0001-linuxjagexlauncher
```

### Step 3: Add Your Packaging Files
Copy the flatpak packaging files from this repository into the cloned `flathub` folder:
```bash
# Assuming Linux-Jagex-Launcher is in ~/Documents/Linux-Jagex-Launcher:
REPO_PATH="/home/daniel-cook/Documents/Linux-Jagex-Launcher"

cp "${REPO_PATH}/packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.yml" .
cp "${REPO_PATH}/packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.metainfo.xml" .
cp "${REPO_PATH}/packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.desktop" .
```

### Step 4: Commit and Push
```bash
git add io.github.cook0001.LinuxJagexLauncher.*
git commit -m "Add io.github.cook0001.LinuxJagexLauncher"
git push origin add-io-github-cook0001-linuxjagexlauncher
```

### Step 5: Open the Pull Request on GitHub
1. Navigate to [https://github.com/flathub/flathub/pulls](https://github.com/flathub/flathub/pulls).
2. Click **"New pull request"**.
3. **Set Base Branch:**
   - **Base repository:** `flathub/flathub`
   - **Base branch:** `new-pr` (⚠️ **Do NOT select `master`**)
   - **Head repository:** `cook0001/flathub`
   - **Compare branch:** `add-io-github-cook0001-linuxjagexlauncher`
4. **Pull Request Title:**
   ```
   Add io.github.cook0001.LinuxJagexLauncher
   ```
5. **Pull Request Description:**
   Complete the checklist provided in the GitHub PR template. Confirm:
   - Application builds and runs cleanly.
   - Metainfo and desktop files validate.
   - You are the author/maintainer of the application.

---

## 7. Review, Test Builds & Developer Verification

1. **Automated CI Bot Checks:**
   - The Flathub bot will run automated linters on your submission.
   - You can trigger a test build in the PR comments at any time by posting:
     ```
     bot, build
     ```
2. **Review Comments:**
   - Reviewers may ask questions or request minor adjustments to permissions or manifest syntax. Reply directly and push commits to your branch.
3. **Approval & Repository Creation:**
   - Once approved, reviewers merge the PR and create a new repository under the Flathub organization: `https://github.com/flathub/io.github.cook0001.LinuxJagexLauncher`.
   - You will receive a GitHub invitation granting you write access to maintain the package.
4. **Claim Developer Verification on Flathub.org:**
   - Visit [https://flathub.org/developer-portal](https://flathub.org/developer-portal).
   - Log in using your GitHub account (`cook0001`).
   - Flathub automatically verifies ownership for apps using `io.github.cook0001.*`, awarding your app the official **Verified Developer Checkmark**!
