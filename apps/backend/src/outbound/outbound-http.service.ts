import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import * as https from 'node:https';
import * as tls from 'node:tls';
import { assertAllowedOutboundUrl } from './outbound-url-policy';

export type OutboundHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OutboundHttpRequestOptions {
  method?: OutboundHttpMethod;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
}

export interface OutboundHttpResponse {
  statusCode: number;
  ok: boolean;
  headers: IncomingHttpHeaders;
  body: string;
  durationMs: number;
}

interface NormalizedOutboundRequest {
  method: OutboundHttpMethod;
  headers: Record<string, string>;
  body?: string | Buffer;
  timeoutMs: number;
}

@Injectable()
export class OutboundHttpService {
  private static readonly defaultTimeoutMs = 10000;
  private static readonly maxResponseBytes = 256 * 1024;

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
    const target = assertAllowedOutboundUrl(url);

    const request = this.normalizeRequest(options);
    const proxyUrl = this.getProxyUrl();

    if (!proxyUrl) {
      return this.directRequest(target, request);
    }

    const proxy = new URL(proxyUrl);
    if (proxy.protocol !== 'http:') {
      throw new Error('AFROGATE_OUTBOUND_PROXY_URL must point to an HTTP proxy');
    }

    return target.protocol === 'https:'
      ? this.httpsViaHttpProxy(target, proxy, request)
      : this.httpViaHttpProxy(target, proxy, request);
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
    };
  }

  private directRequest(target: URL, request: NormalizedOutboundRequest): Promise<OutboundHttpResponse> {
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
  ): Promise<OutboundHttpResponse> {
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
  ): Promise<OutboundHttpResponse> {
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
          (response) => this.collectResponse(response, startedAt, resolve, reject),
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
  ): Promise<OutboundHttpResponse> {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const outboundRequest = client.request(options, (response) =>
        this.collectResponse(response, startedAt, resolve, reject),
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
    resolve: (value: OutboundHttpResponse) => void,
    reject: (reason?: unknown) => void,
  ): void {
    const chunks: Buffer[] = [];
    let size = 0;

    response.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > OutboundHttpService.maxResponseBytes) {
        response.destroy(new Error('Outbound HTTP response exceeded the maximum size'));
        return;
      }

      chunks.push(chunk);
    });
    response.once('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
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
    const value = this.config.get<string>('AFROGATE_OUTBOUND_PROXY_URL')?.trim();
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
