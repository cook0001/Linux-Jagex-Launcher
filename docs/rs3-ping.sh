#!/usr/bin/env bash

# Linux Jagex Launcher - High-Performance RS3 World Latency Benchmarker
# Concurrently tests RuneScape 3 worlds (1..141) and outputs lowest-ping worlds.

ping_world() {
  local w=$1
  local pingval
  # -W 1 for Linux, -t 1 for macOS timeout
  if pingval=$(ping -c 1 -W 1 "world${w}.runescape.com" 2>/dev/null || ping -c 1 -t 1 "world${w}.runescape.com" 2>/dev/null); then
    local res=$(echo "$pingval" | awk -F"/" '/(min\/avg\/max|rtt)/ {print $5}')
    if [ -n "$res" ]; then
      printf "World %3d: %6.2f ms\n" "$w" "$res"
    fi
  fi
}
export -f ping_world

echo "⚡ Pinging RuneScape 3 worlds (1..141) concurrently..."
echo "------------------------------------------------------"
seq 1 141 | xargs -P 25 -n 1 -I {} bash -c 'ping_world "$@"' _ {} | sort -k 3 -n | head -n 10
echo "------------------------------------------------------"
echo "Top recommended worlds for lowest in-game latency."
