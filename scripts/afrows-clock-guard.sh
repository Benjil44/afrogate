#!/bin/sh
# Afrows 2026-11-02: the provider froze this VM for ~11.5 h; on resume the clock was
# 11.5 h behind and Shadowsocks-2022 (timestamp-checked) failed. Force a resync when
# the clock is off by more than 60 s versus the USA exit's HTTP Date header.
ref=$(curl -sI -m 8 https://www.google.com 2>/dev/null | sed -n 's/^[Dd]ate: //p' | tr -d '\r')
[ -n "$ref" ] || exit 0
skew=$(( $(date +%s) - $(date -d "$ref" +%s) ))
[ ${skew#-} -gt 60 ] || exit 0
logger -t afrows-clock-guard "clock skew ${skew}s, forcing resync"
if command -v chronyc >/dev/null; then chronyc -a makestep; else systemctl restart systemd-timesyncd; fi
