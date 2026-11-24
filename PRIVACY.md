# Privacy Policy

**Effective Date:** September 28, 2026  
**Project:** PatchCraft Launcher (formerly Linux Jagex Launcher; package slug `linux-jagex-launcher`)  
**Repository:** [https://github.com/cook0001/Linux-Jagex-Launcher](https://github.com/cook0001/Linux-Jagex-Launcher)

Your privacy and account security are our highest priority. **PatchCraft Launcher** is an unofficial Linux launcher for RuneScape &amp; Jagex Accounts built with a zero-telemetry, client-side only security model.

---

## 1. Zero Background Telemetry & Opt-In Issue Reporting
- We do **not** collect background telemetry, analytics, crash dumps, account identifiers, or usage tracking metrics.
- Normal launcher usage connects **only** to:
  1. **Official Jagex Identity & Game Services** (`account.jagex.com`, `auth.jagex.com`, `secure.runescape.com`, `content.jagex.com`).
  2. **Official Game & Update Endpoints** (GitHub Releases for updates/RuneLite and official CDN for HDOS).
- **Optional User-Initiated Issue Reports:** If you explicitly click **Submit In-App** in the Issue Reporter (or submit via the website form at `launcher.patchcraft.dev`), only the title, description, and previewed redacted system diagnostics you approve are relayed via `reports.patchcraft.dev` directly to our public GitHub Issues tracker. Session tokens, passwords, email addresses, and local usernames are scrubbed before transmission.

---

## 2. Direct Official Jagex Authentication
- **OAuth 2.0 with PKCE**: All sign-in requests use official OAuth 2.0 Proof Key for Code Exchange (PKCE) directly against Jagex authorization servers.
- **Never Intercepts Passwords**: Your Jagex Account password is submitted directly to `account.jagex.com`. The launcher never reads, stores, or logs your plain-text password.
- **Local Credential Storage**:
  - Authenticated session tokens and character lists are stored exclusively on your local machine in your user directory:
    ```
    ~/.config/linux-jagex-launcher/
    ```
  - Standard Linux filesystem permissions (`0700` / `0600`) restrict access strictly to your local user account.

---

## 3. Game Launch & Local Session Handoff
- When launching **Old School RuneScape (RuneLite/HDOS)** or **RuneScape 3**:
  - Active session tokens and selected character details are passed directly to the local game client subprocess on your machine.
  - Nothing is transmitted over external networks other than your game client communicating directly with Jagex game worlds.
- The user's home directory (`~/.runelite` or standard user profile) is preserved intact so browser links open in your default browser.

---

## 4. Website (`launcher.patchcraft.dev`) & Third-Party Services
- The project website runs no first-party analytics, advertising trackers, or Google Fonts requests.
- **Hosting & DNS:** Hosted on GitHub Pages behind Cloudflare DNS; standard request logs are governed by GitHub and Cloudflare privacy policies.
- **Issue Reporter & Anti-Spam:** The feedback section fetches recent discussion summaries from `reports.patchcraft.dev` and uses Cloudflare Turnstile (`challenges.cloudflare.com`) to prevent automated spam. Only reports you explicitly submit are relayed to public GitHub Issues.
- **Third-Party Badges:** Snap Store install and build-status badge images are served from `snapcraft.io`.
- See [https://patchcraft.dev/legal.html](https://patchcraft.dev/legal.html) for domain-wide legal, trademark, and attribution notices.

---

## 5. Proprietary License & Release Verification
- **PatchCraft Launcher** is distributed as proprietary freeware under the [Proprietary Software License](LICENSE) for personal, non-commercial use (third-party Electron/Chromium open-source notices are bundled alongside the binary in `LICENSE.electron.txt` and `LICENSES.chromium.html`).
- Official release packages include published `SHA256SUMS.txt` checksums on GitHub Releases so you can verify download integrity before installing or updating.

---

## 6. Contact & Questions
If you have questions regarding security or privacy, please open an issue or security advisory on GitHub:  
[https://github.com/cook0001/Linux-Jagex-Launcher/issues](https://github.com/cook0001/Linux-Jagex-Launcher/issues)
