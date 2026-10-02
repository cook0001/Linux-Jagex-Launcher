Name:           linux-jagex-launcher
Version:        1.4.4
Release:        1%{?dist}
Summary:        Authentic, native Jagex Launcher for Linux
License:        MIT
URL:            https://cook0001.github.io/Linux-Jagex-Launcher/
Source0:        https://github.com/cook0001/Linux-Jagex-Launcher/releases/download/v%{version}/linux-jagex-launcher-%{version}.tar.gz
Source1:        https://raw.githubusercontent.com/cook0001/Linux-Jagex-Launcher/v%{version}/packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.desktop
Source2:        https://raw.githubusercontent.com/cook0001/Linux-Jagex-Launcher/v%{version}/packaging/flatpak/io.github.cook0001.LinuxJagexLauncher.metainfo.xml
Source3:        https://raw.githubusercontent.com/cook0001/Linux-Jagex-Launcher/v%{version}/resources/icons/512x512.png
Source4:        https://raw.githubusercontent.com/cook0001/Linux-Jagex-Launcher/v%{version}/resources/icons/256x256.png
Source5:        https://raw.githubusercontent.com/cook0001/Linux-Jagex-Launcher/v%{version}/resources/icons/128x128.png
Source6:        https://raw.githubusercontent.com/cook0001/Linux-Jagex-Launcher/v%{version}/resources/icons/64x64.png
Source7:        https://raw.githubusercontent.com/cook0001/Linux-Jagex-Launcher/v%{version}/resources/icons/32x32.png
Source8:        https://raw.githubusercontent.com/cook0001/Linux-Jagex-Launcher/v%{version}/resources/icons/16x16.png

ExclusiveArch:  x86_64

# Fedora / RHEL Runtime Dependencies
Requires:       gtk3
Requires:       nss
Requires:       libXScrnSaver
Requires:       libXtst
Requires:       xdg-utils
Requires:       at-spi2-core
Requires:       libdrm
Requires:       mesa-libgbm
Requires:       alsa-lib
Requires:       tar
Requires:       xz

# Optional Enhancements
Recommends:     java-21-openjdk
Recommends:     gamemode
Recommends:     mangohud

# Package Aliases & Upgrade Conflicts
Provides:       jagex-launcher = %{version}-%{release}
Conflicts:      jagex-launcher

# Turn off binary strip and debuginfo generation for pre-built Electron binary
%global __strip /bin/true
%global debug_package %{nil}
%global __requires_exclude ^(libffmpeg\\.so.*|libvk_swiftshader\\.so.*|libvulkan\\.so.*)$

%description
Authentic, native Jagex Launcher for Linux supporting RuneScape 3 and
Old School RuneScape (RuneLite, HDOS, and Official client) with direct
OAuth 2.0 PKCE authentication, live world ping prober, multi-account
switching, and native system tray integration.

%prep
%setup -q -c -n %{name}-%{version}

%build
# Pre-compiled application binary; no compilation needed

%install
rm -rf %{buildroot}

# 1. Install application bundle into /opt/linux-jagex-launcher
install -d -m 0755 %{buildroot}/opt/%{name}
cp -a * %{buildroot}/opt/%{name}/
chmod 0755 %{buildroot}/opt/%{name}/linux-jagex-launcher
if [ -f %{buildroot}/opt/%{name}/chrome-sandbox ]; then
    chmod 4755 %{buildroot}/opt/%{name}/chrome-sandbox
fi

# 2. Symlink binaries to /usr/bin for immediate terminal execution
install -d -m 0755 %{buildroot}%{_bindir}
ln -sf /opt/%{name}/linux-jagex-launcher %{buildroot}%{_bindir}/%{name}
ln -sf /opt/%{name}/linux-jagex-launcher %{buildroot}%{_bindir}/jagex-launcher

# 3. Install Desktop Entry
install -d -m 0755 %{buildroot}%{_datadir}/applications
install -m 0644 %{SOURCE1} %{buildroot}%{_datadir}/applications/io.github.cook0001.LinuxJagexLauncher.desktop

# 4. Install AppStream MetaInfo
install -d -m 0755 %{buildroot}%{_metainfodir}
install -m 0644 %{SOURCE2} %{buildroot}%{_metainfodir}/io.github.cook0001.LinuxJagexLauncher.metainfo.xml

# 5. Install Hicolor Icon Theme suite
install -d -m 0755 %{buildroot}%{_datadir}/icons/hicolor/512x512/apps
install -m 0644 %{SOURCE3} %{buildroot}%{_datadir}/icons/hicolor/512x512/apps/io.github.cook0001.LinuxJagexLauncher.png

install -d -m 0755 %{buildroot}%{_datadir}/icons/hicolor/256x256/apps
install -m 0644 %{SOURCE4} %{buildroot}%{_datadir}/icons/hicolor/256x256/apps/io.github.cook0001.LinuxJagexLauncher.png

install -d -m 0755 %{buildroot}%{_datadir}/icons/hicolor/128x128/apps
install -m 0644 %{SOURCE5} %{buildroot}%{_datadir}/icons/hicolor/128x128/apps/io.github.cook0001.LinuxJagexLauncher.png

install -d -m 0755 %{buildroot}%{_datadir}/icons/hicolor/64x64/apps
install -m 0644 %{SOURCE6} %{buildroot}%{_datadir}/icons/hicolor/64x64/apps/io.github.cook0001.LinuxJagexLauncher.png

install -d -m 0755 %{buildroot}%{_datadir}/icons/hicolor/32x32/apps
install -m 0644 %{SOURCE7} %{buildroot}%{_datadir}/icons/hicolor/32x32/apps/io.github.cook0001.LinuxJagexLauncher.png

install -d -m 0755 %{buildroot}%{_datadir}/icons/hicolor/16x16/apps
install -m 0644 %{SOURCE8} %{buildroot}%{_datadir}/icons/hicolor/16x16/apps/io.github.cook0001.LinuxJagexLauncher.png

%files
/opt/%{name}
%{_bindir}/%{name}
%{_bindir}/jagex-launcher
%{_datadir}/applications/io.github.cook0001.LinuxJagexLauncher.desktop
%{_metainfodir}/io.github.cook0001.LinuxJagexLauncher.metainfo.xml
%{_datadir}/icons/hicolor/*/apps/io.github.cook0001.LinuxJagexLauncher.png

%changelog
* Wed Oct 01 2026 Daniel Cook <danielcook2016@outlook.com> - 1.4.4-1
- Release v1.4.4: Version synchronization, AUR binary paths, and Debian package relationships
