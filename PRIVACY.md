# Privacy Policy

**Effective Date:** September 28, 2026  
**Project:** Linux Jagex Launcher  
**Repository:** [https://github.com/cook0001/Linux-Jagex-Launcher](https://github.com/cook0001/Linux-Jagex-Launcher)

Your privacy and account security are our highest priority. **Linux Jagex Launcher** is built with a zero-telemetry, client-side only security model.

---

## 1. Zero Data Collection & No External Servers
- We do **not** own, operate, or maintain any intermediate proxy servers, analytics endpoints, or databases.
- The launcher connects **exclusively** to:
  1. **Official Jagex Identity & Game Services** (`account.jagex.com`, `auth.jagex.com`, `secure.runescape.com`, `content.jagex.com`).
  2. **Official Open-Source Client Repositories** (GitHub releases for RuneLite and official CDN for HDOS).
- No personal data, IP addresses, telemetry, crash dumps, or usage metrics are collected, tracked, or transmitted to any third party.

---

## 2. Direct Official Jagex Authentication
- **OAuth 2.0 with PKCE**: All sign-in requests use official OAuth 2.0 Proof Key for Code Exchange (PKCE) directly against Jagex authorization servers.
- **Never Intercepts Passwords**: Your Jagex Account password is submitted directly to `account.jagex.com`. The launcher never reads, stores, or logs your plain-text password.
- **Local Credential Storage**:
  - Session tokens (`JX_SESSION_ID`), user ID (`sub`), and character lists are stored exclusively on your local machine in your user directory:
    ```
    ~/.config/linux-jagex-launcher/
    ```
  - Standard Linux filesystem permissions (`0700` / `0600`) restrict access strictly to your local user account.

---

## 3. Game Launch & Environment Injection
- When launching **Old School RuneScape (RuneLite/HDOS)** or **RuneScape 3**:
  - Session credentials (`JX_SESSION_ID`, `JX_CHARACTER_ID`, `JX_DISPLAY_NAME`) are passed directly via local process environment variables to the game client subprocess on your machine.
  - Nothing is transmitted over external networks other than your game client communicating directly with Jagex game worlds.
- The user's home directory (`~/.runelite` or standard user profile) is preserved intact so browser links open in your default browser.

---

## 4. Open Source & Verifiable
- All source code for this launcher is 100% open source under the **MIT License**.
- You can inspect, audit, and build every component directly from the source code repository.

---

## 5. Contact & Questions
If you have questions regarding security or privacy, please open an issue or security advisory on GitHub:  
[https://github.com/cook0001/Linux-Jagex-Launcher/issues](https://github.com/cook0001/Linux-Jagex-Launcher/issues)
