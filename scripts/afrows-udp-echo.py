#!/usr/bin/env python3
# Minimal UDP echo so the app can detect whether THIS network can reach the
# Afrows server over UDP (a proxy for "WireGuard/UDP will work"). Echoes any
# datagram back to its sender. Port from AFROWS_UDP_PROBE_PORT (default 51821).
import os, socket
port = int(os.environ.get('AFROWS_UDP_PROBE_PORT', '51821'))
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.bind(('0.0.0.0', port))
print(f'afrows-udp-echo on :{port}', flush=True)
while True:
    data, addr = s.recvfrom(64)
    try:
        s.sendto(data[:64], addr)
    except OSError:
        pass
