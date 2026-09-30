#!/usr/bin/env bash
set -e
# Canonical wrapper for Linux Jagex Launcher
if [[ -x "/usr/bin/linux-jagex-launcher" ]]; then
  exec /usr/bin/linux-jagex-launcher "$@"
else
  exec /usr/lib/linux-jagex-launcher/linux-jagex-launcher "$@"
fi
