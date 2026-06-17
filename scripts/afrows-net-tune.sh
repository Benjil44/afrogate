#!/usr/bin/env bash
# Afrows network/stability tuning (idempotent; run as root on the VPS and on any
# relay you own). Enables BBR + fq, MTU black-hole probing, TCP Fast Open, larger
# buffers, and keeps throughput after idle — big wins on lossy/throttled links.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

# BBR needs the module loaded + persisted across reboots
modprobe tcp_bbr 2>/dev/null || true
echo tcp_bbr > /etc/modules-load.d/afrows-bbr.conf

cat > /etc/sysctl.d/99-afrows-net.conf <<'EOF'
# --- Afrows network tuning ---
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_mtu_probing = 1
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_notsent_lowat = 16384
net.core.somaxconn = 4096
net.core.netdev_max_backlog = 16384
net.ipv4.tcp_max_syn_backlog = 8192
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.udp_rmem_min = 8192
net.ipv4.udp_wmem_min = 8192
fs.file-max = 2097152
EOF

sysctl --system >/dev/null
echo "applied: cc=$(sysctl -n net.ipv4.tcp_congestion_control) qdisc=$(sysctl -n net.core.default_qdisc) mtu_probing=$(sysctl -n net.ipv4.tcp_mtu_probing) tfo=$(sysctl -n net.ipv4.tcp_fastopen)"
