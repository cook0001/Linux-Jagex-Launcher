# Arch User Repository (AUR) Package

This directory contains the packaging specifications to publish `linux-jagex-launcher-bin` to the Arch User Repository (AUR) for Arch Linux, Manjaro, EndeavourOS, and SteamOS (Steam Deck).

## 📦 Package Details
- **Package Name:** `linux-jagex-launcher-bin`
- **Upstream URL:** https://github.com/cook0001/Linux-Jagex-Launcher
- **Provides:** `jagex-launcher`, `linux-jagex-launcher`

---

## 🚀 How to Publish to the AUR

1. Register an account on [https://aur.archlinux.org/](https://aur.archlinux.org/) and upload your SSH public key.
2. Clone the empty AUR repository:
   ```bash
   git clone ssh://aur@aur.archlinux.org/linux-jagex-launcher-bin.git
   cd linux-jagex-launcher-bin
   ```
3. Copy `PKGBUILD` and `.SRCINFO` into the cloned repository:
   ```bash
   cp /path/to/packaging/aur/PKGBUILD .
   cp /path/to/packaging/aur/.SRCINFO .
   ```
4. Test locally with `makepkg`:
   ```bash
   makepkg -si
   ```
5. Commit and push:
   ```bash
   git add PKGBUILD .SRCINFO
   git commit -m "Initial release v1.0.0"
   git push origin master
   ```

---

## 📥 How Users Install on Arch Linux & SteamOS

Once published to the AUR, users can install with a single command:

```bash
# Using yay:
yay -S linux-jagex-launcher-bin

# Using paru:
paru -S linux-jagex-launcher-bin
```
