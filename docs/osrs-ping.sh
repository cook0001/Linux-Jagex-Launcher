#!/usr/bin/env bash

# Linux Jagex Launcher - High-Performance OSRS World Latency Benchmarker
# Concurrently tests Old School RuneScape worlds (301..550+) and outputs lowest-ping worlds.

ping_osrs_world() {
  local sub=$1
  local in_game_world=$((300 + sub))
  local pingval
  # -W 1 for Linux, -t 1 for macOS timeout
  if pingval=$(ping -c 1 -W 1 "oldschool${sub}.runescape.com" 2>/dev/null || ping -c 1 -t 1 "oldschool${sub}.runescape.com" 2>/dev/null); then
    local res=$(echo "$pingval" | awk -F"/" '/(min\/avg\/max|rtt)/ {print $5}')
    if [ -n "$res" ]; then
      printf "World %3d (server %3d): %6.2f ms\n" "$in_game_world" "$sub" "$res"
    fi
  fi
}
export -f ping_osrs_world

echo "⚡ Pinging Old School RuneScape worlds (301+) concurrently..."
echo "-------------------------------------------------------------"
seq 1 250 | xargs -P 25 -n 1 -I {} bash -c 'ping_osrs_world "$@"' _ {} | sort -k 4 -n | head -n 10
echo "-------------------------------------------------------------"
echo "Top recommended OSRS worlds for lowest in-game latency."
