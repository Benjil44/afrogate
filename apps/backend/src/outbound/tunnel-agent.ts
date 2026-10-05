import * as http from 'node:http';
import * as https from 'node:https';
import type net from 'node:net';
import * as tls from 'node:tls';

/**
 * A single-use Agent that hands Node's HTTP client an ALREADY-ESTABLISHED tunnel
 * socket (e.g. after a SOCKS5 CONNECT) instead of dialing the target itself.
 *
 * Why not `{ agent: false, createConnection }`: with `agent: false` Node builds a
 * fresh default Agent, and an Agent always dials via its own `createConnection`
 * method — the request option is ignored. The tunnel was opened and then left
 * unused while the request went straight to the target (2026-10-05: every
 * Telegram poll timed out against 149.154.x.x despite the SOCKS proxy).
 */
export function tunnelAgent(isHttps: boolean, socket: net.Socket, servername: string): http.Agent {
  const agent = isHttps ? new https.Agent({ keepAlive: false }) : new http.Agent({ keepAlive: false });
  (agent as unknown as { createConnection: () => net.Socket }).createConnection = () =>
    isHttps ? tls.connect({ socket, servername }) : socket;
  return agent;
}
