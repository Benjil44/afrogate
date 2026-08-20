import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { assertAllowedOutboundUrl } from './outbound-url-policy';

export type OutboundHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OutboundHttpRequestOptions {
  method?: OutboundHttpMethod;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
  /** Override the response body cap (bytes). Defaults to 256 KiB (text). */
  maxResponseBytes?: number;
}

export interface OutboundHttpResponse {
  statusCode: number;
  ok: boolean;
  headers: IncomingHttpHeaders;
  body: string;
  durationMs: number;
}

export interface OutboundBinaryResponse {
  statusCode: number;
  ok: boolean;
  headers: IncomingHttpHeaders;
  body: Buffer;
  durationMs: number;
}

interface NormalizedOutboundRequest {
  method: OutboundHttpMethod;
  headers: Record<string, string>;
  body?: string | Buffer;
  timeoutMs: number;
  maxResponseBytes: number;
}

@Injectable()
export class OutboundHttpService {
  private static readonly defaultTimeoutMs = 10000;
  private static readonly maxResponseBytes = 256 * 1024;
  /** Larger cap for binary downloads (e.g. Telegram receipt photos). */
  private static readonly maxBinaryResponseBytes = 12 * 1024 * 1024;

  constructor(private readonly config: ConfigService) {}

  async postJson(
    url: string,
    payload: unknown,
    options: Omit<OutboundHttpRequestOptions, 'method' | 'body'> = {},
  ): Promise<OutboundHttpResponse> {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  }

  async request(url: string, options: OutboundHttpRequestOptions = {}): Promise<OutboundHttpResponse> {
    const raw = await this.requestRaw(url, options);
    return { ...raw, body: raw.body.toString('utf8') };
  }

  /**
   * Binary-safe outbound request (Buffer body, larger default cap). Same SSRF
   * URL policy and proxy handling as `request`. Used to proxy Telegram receipt
   * images server-side without corrupting bytes through a utf8 round-trip.
   */
  async requestBinary(url: string, options: OutboundHttpRequestOptions = {}): Promise<OutboundBinaryResponse> {
    return this.requestRaw(url, {
      maxResponseBytes: OutboundHttpService.maxBinaryResponseBytes,
      ...options,
    });
  }

  private async requestRaw(url: string, options: OutboundHttpRequestOptions = {}): Promise<OutboundBinaryResponse> {
    const target = assertAllowedOutboundUrl(url);

    const request = this.normalizeRequest(options);
    const proxyUrl = this.getProxyUrl();

    if (!proxyUrl) {
      return this.directRequest(target, request);
    }

    const proxy = new URL(proxyUrl);
    if (proxy.protocol === 'http:') {
      return target.protocol === 'https:'
        ? this.httpsViaHttpProxy(target, proxy, request)
        : this.httpViaHttpProxy(target, proxy, request);
    }
    // SOCKS5 (e.g. the local egress relay at socks5://127.0.0.1:10808) lets the
    // backend reach hosts the direct uplink filters (e.g. api.telegram.org).
    if (proxy.protocol === 'socks5:' || proxy.protocol === 'socks:' || proxy.protocol === 'socks5h:') {
      return this.viaSocks5(target, proxy, request);
    }
    throw new Error('AFROWS_OUTBOUND_PROXY_URL must be an http:// or socks5:// proxy');
  }

  /**
   * Tunnel the request through a SOCKS5 proxy (CONNECT to target host:port),
   * then run HTTP — or TLS-then-HTTP for https — over the tunnelled socket.
   * Supports optional username/password auth from the proxy URL userinfo.
   */
  private viaSocks5(target: URL, proxy: URL, request: NormalizedOutboundRequest): Promise<OutboundBinaryResponse> {
    const startedAt = Date.now();
    const proxyPort = Number(proxy.port) || 1080;
    const targetPort = Number(target.port) || (target.protocol === 'https:' ? 443 : 80);
    const username = proxy.username ? decodeURIComponent(proxy.username) : '';
    const password = proxy.password ? decodeURIComponent(proxy.password) : '';

    return new Promise((resolve, reject) => {
      const socket = net.connect(proxyPort, proxy.hostname);
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };

      socket.setTimeout(request.timeoutMs, () => fail(new Error('SOCKS proxy timed out')));
      socket.once('error', fail);
      socket.once('end', () => fail(new Error('SOCKS proxy closed the connection')));

      const sendConnect = () => {
        const host = Buffer.from(target.hostname, 'utf8');
        const portBuf = Buffer.alloc(2);
        portBuf.writeUInt16BE(targetPort, 0);
        socket.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, host.length]), host, portBuf]));
      };

      let phase: 'greeting' | 'auth' | 'connect' = 'greeting';
      let buffer = Buffer.alloc(0);

      const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);

        if (phase === 'greeting') {
          if (buffer.length < 2) return;
          if (buffer[0] !== 0x05) return fail(new Error('SOCKS5: unexpected version'));
          const method = buffer[1];
          buffer = buffer.subarray(2);
          if (method === 0x00) {
            phase = 'connect';
            sendConnect();
          } else if (method === 0x02) {
            if (!username) return fail(new Error('SOCKS5: proxy requires authentication'));
            phase = 'auth';
            const user = Buffer.from(username, 'utf8');
            const pass = Buffer.from(password, 'utf8');
            socket.write(
              Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass]),
            );
          } else {
            fail(new Error('SOCKS5: no acceptable auth method'));
          }
          return;
        }

        if (phase === 'auth') {
          if (buffer.length < 2) return;
          if (buffer[1] !== 0x00) return fail(new Error('SOCKS5: authentication failed'));
          buffer = buffer.subarray(2);
          phase = 'connect';
          sendConnect();
          return;
        }

        // phase === 'connect' — parse the CONNECT reply.
        if (buffer.length < 4) return;
        if (buffer[1] !== 0x00) return fail(new Error(`SOCKS5: connect failed (0x${buffer[1].toString(16)})`));
        const atyp = buffer[3];
        let needed = 4 + 2; // header + 2-byte bound port
        if (atyp === 0x01) needed += 4;
        else if (atyp === 0x04) needed += 16;
        else if (atyp === 0x03) {
          if (buffer.length < 5) return;
          needed += 1 + buffer[4];
        } else return fail(new Error('SOCKS5: unsupported address type in reply'));
        if (buffer.length < needed) return;

        // Tunnel established; hand the raw socket to the HTTP(S) request path.
        socket.removeListener('data', onData);
        socket.setTimeout(0);
        settled = true;
        this.requestOverSocket(target, targetPort, socket, request, startedAt, resolve, reject);
      };

      socket.on('data', onData);
      socket.once('connect', () => {
        // greeting: SOCKS5, offer no-auth (0x00) and username/password (0x02).
        socket.write(Buffer.from([0x05, 0x02, 0x00, 0x02]));
      });
    });
  }

  /** Run one HTTP(S) request over an already-connected (tunnelled) socket. */
  private requestOverSocket(
    target: URL,
    targetPort: number,
    socket: net.Socket,
    request: NormalizedOutboundRequest,
    startedAt: number,
    resolve: (value: OutboundBinaryResponse) => void,
    reject: (reason?: unknown) => void,
  ): void {
    const isHttps = target.protocol === 'https:';
    const client = isHttps ? https : http;
    const outboundRequest = client.request(
      {
        hostname: target.hostname,
        port: targetPort,
        method: request.method,
        path: this.targetPath(target),
        headers: { ...request.headers, Host: target.host },
        agent: false,
        createConnection: () => (isHttps ? tls.connect({ socket, servername: target.hostname }) : socket),
      },
      (response) => this.collectResponse(response, startedAt, request.maxResponseBytes, resolve, reject),
    );
    outboundRequest.setTimeout(request.timeoutMs, () => {
      outboundRequest.destroy(new Error('Outbound request over SOCKS timed out'));
    });
    outboundRequest.once('error', reject);
    outboundRequest.end(request.body);
  }

  private normalizeRequest(options: OutboundHttpRequestOptions): NormalizedOutboundRequest {
    const headers = { ...(options.headers ?? {}) };

    if (options.body && !this.hasHeader(headers, 'Content-Length')) {
      headers['Content-Length'] = String(Buffer.byteLength(options.body));
    }

    return {
      method: options.method ?? 'GET',
      headers,
      body: options.body,
      timeoutMs: options.timeoutMs ?? OutboundHttpService.defaultTimeoutMs,
      maxResponseBytes: options.maxResponseBytes ?? OutboundHttpService.maxResponseBytes,
    };
  }

  private directRequest(target: URL, request: NormalizedOutboundRequest): Promise<OutboundBinaryResponse> {
    const client = target.protocol === 'https:' ? https : http;

    return this.performRequest(
      client,
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        method: request.method,
        path: this.targetPath(target),
        headers: request.headers,
      },
      request,
    );
  }

  private httpViaHttpProxy(
    target: URL,
    proxy: URL,
    request: NormalizedOutboundRequest,
  ): Promise<OutboundBinaryResponse> {
    return this.performRequest(
      http,
      {
        protocol: proxy.protocol,
        hostname: proxy.hostname,
        port: proxy.port || '80',
        method: request.method,
        path: target.toString(),
        headers: {
          ...request.headers,
          Host: target.host,
          ...this.proxyAuthHeader(proxy),
        },
      },
      request,
    );
  }

  private httpsViaHttpProxy(
    target: URL,
    proxy: URL,
    request: NormalizedOutboundRequest,
  ): Promise<OutboundBinaryResponse> {
    const startedAt = Date.now();
    const targetPort = target.port || '443';

    return new Promise((resolve, reject) => {
      const connectRequest = http.request({
        hostname: proxy.hostname,
        port: proxy.port || '80',
        method: 'CONNECT',
        path: `${target.hostname}:${targetPort}`,
        headers: this.proxyAuthHeader(proxy),
      });

      connectRequest.setTimeout(request.timeoutMs, () => {
        connectRequest.destroy(new Error('Outbound proxy CONNECT timed out'));
      });

      connectRequest.once('connect', (connectResponse, socket) => {
        if (connectResponse.statusCode !== 200) {
          socket.destroy();
          reject(new Error(`Outbound proxy CONNECT failed with status ${connectResponse.statusCode ?? 0}`));
          return;
        }

        const proxiedRequest = https.request(
          {
            hostname: target.hostname,
            port: targetPort,
            method: request.method,
            path: this.targetPath(target),
            headers: {
              ...request.headers,
              Host: target.host,
            },
            agent: false,
            createConnection: () =>
              tls.connect({
                socket,
                servername: target.hostname,
              }),
          },
          (response) => this.collectResponse(response, startedAt, request.maxResponseBytes, resolve, reject),
        );

        proxiedRequest.setTimeout(request.timeoutMs, () => {
          proxiedRequest.destroy(new Error('Outbound HTTPS request timed out'));
        });
        proxiedRequest.once('error', reject);
        proxiedRequest.end(request.body);
      });

      connectRequest.once('response', (response) => {
        response.resume();
        reject(new Error(`Outbound proxy refused CONNECT with status ${response.statusCode ?? 0}`));
      });
      connectRequest.once('error', reject);
      connectRequest.end();
    });
  }

  private performRequest(
    client: typeof http | typeof https,
    options: http.RequestOptions | https.RequestOptions,
    request: NormalizedOutboundRequest,
  ): Promise<OutboundBinaryResponse> {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const outboundRequest = client.request(options, (response) =>
        this.collectResponse(response, startedAt, request.maxResponseBytes, resolve, reject),
      );

      outboundRequest.setTimeout(request.timeoutMs, () => {
        outboundRequest.destroy(new Error('Outbound HTTP request timed out'));
      });
      outboundRequest.once('error', reject);
      outboundRequest.end(request.body);
    });
  }

  private collectResponse(
    response: IncomingMessage,
    startedAt: number,
    maxResponseBytes: number,
    resolve: (value: OutboundBinaryResponse) => void,
    reject: (reason?: unknown) => void,
  ): void {
    const chunks: Buffer[] = [];
    let size = 0;

    response.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxResponseBytes) {
        response.destroy(new Error('Outbound HTTP response exceeded the maximum size'));
        return;
      }

      chunks.push(chunk);
    });
    response.once('end', () => {
      const body = Buffer.concat(chunks);
      const statusCode = response.statusCode ?? 0;

      resolve({
        statusCode,
        ok: statusCode >= 200 && statusCode < 300,
        headers: response.headers,
        body,
        durationMs: Date.now() - startedAt,
      });
    });
    response.once('error', reject);
  }

  private getProxyUrl(): string | undefined {
    const value = this.config.get<string>('AFROWS_OUTBOUND_PROXY_URL')?.trim();
    return value || undefined;
  }

  private proxyAuthHeader(proxy: URL): Record<string, string> {
    if (!proxy.username && !proxy.password) return {};

    const username = decodeURIComponent(proxy.username);
    const password = decodeURIComponent(proxy.password);
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    return {
      'Proxy-Authorization': `Basic ${credentials}`,
    };
  }

  private targetPath(target: URL): string {
    return `${target.pathname || '/'}${target.search}`;
  }

  private hasHeader(headers: Record<string, string>, name: string): boolean {
    return Object.keys(headers).some((header) => header.toLowerCase() === name.toLowerCase());
  }
}
