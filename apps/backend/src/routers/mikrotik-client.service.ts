import { Injectable } from '@nestjs/common';
import * as http from 'node:http';

export interface MikroTikTarget {
  host: string;
  port: number;
  user: string;
  password: string;
}

/**
 * Minimal MikroTik RouterOS REST client. Talks to the operator's routers over the
 * WireGuard tunnels (private IPs, e.g. 10.20.0.2) — deliberately NOT routed through
 * the SSRF outbound policy, since these are internal management targets.
 * RouterOS writes use `POST /rest/{path}/{add|set|remove}` (PATCH/DELETE-by-id are
 * silently ignored on these boxes).
 */
@Injectable()
export class MikroTikClientService {
  async call<T = unknown>(
    target: MikroTikTarget,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    timeoutMs = 8000,
  ): Promise<T> {
    const data = body !== undefined ? JSON.stringify(body) : undefined;
    const auth = Buffer.from(`${target.user}:${target.password}`).toString('base64');

    return new Promise<T>((resolve, reject) => {
      const req = http.request(
        {
          host: target.host,
          port: target.port,
          method,
          path: `/rest${path}`,
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
            ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.once('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            const status = res.statusCode ?? 0;
            if (status >= 400) {
              reject(new Error(`MikroTik ${method} ${path} -> ${status}: ${text.slice(0, 200)}`));
              return;
            }
            try {
              resolve((text ? JSON.parse(text) : null) as T);
            } catch {
              reject(new Error('MikroTik returned non-JSON response'));
            }
          });
          res.once('error', reject);
        },
      );

      req.setTimeout(timeoutMs, () => req.destroy(new Error('MikroTik request timed out')));
      req.once('error', reject);
      req.end(data);
    });
  }
}
