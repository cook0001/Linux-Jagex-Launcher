# PatchCraft Launcher — Flatpak Repository

PatchCraft Launcher is distributed through the GPG-signed PatchCraft Flatpak repository hosted at `https://repo.patchcraft.dev/flatpak/`.

It bundles Java 21 (OpenJDK), GTK2, and OpenSSL 1.1 inside the Flatpak sandbox (`org.freedesktop.Platform//26.08` + `org.electronjs.Electron2.BaseApp//26.08`) so RuneScape 3 NXT, RuneLite, and HDOS work out of the box without modifying host system libraries.

## Install

```bash
flatpak install --user https://repo.patchcraft.dev/flatpak/patchcraft.flatpakref
flatpak run dev.patchcraft.Launcher
```

This registers the `patchcraft` Flatpak remote automatically so future releases arrive through `flatpak update`, GNOME Software, or KDE Discover.

## Add the Remote Manually

```bash
flatpak remote-add --user --if-not-exists patchcraft https://repo.patchcraft.dev/flatpak/patchcraft.flatpakrepo
flatpak install --user patchcraft dev.patchcraft.Launcher
```

## Update or Uninstall

```bash
flatpak update --user dev.patchcraft.Launcher
flatpak uninstall --user dev.patchcraft.Launcher
```

## Licensing

PatchCraft Launcher is proprietary software (`LicenseRef-proprietary`); see the root [LICENSE](../../LICENSE) for terms.
