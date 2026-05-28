import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_METADATA_KEY, type RateLimitOptions } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

interface HttpRequestLike {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: {
    remoteAddress?: string;
  };
}

interface HttpResponseLike {
  setHeader?: (name: string, value: string | number) => void;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options || !this.rateLimit.isEnabled()) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpResponseLike>();
    const clientKey = this.clientKey(request);
    const decision = this.rateLimit.consume(`${options.key}:${clientKey}`, options);

    response.setHeader?.('X-RateLimit-Limit', decision.limit);
    response.setHeader?.('X-RateLimit-Remaining', decision.remaining);
    response.setHeader?.('X-RateLimit-Reset', Math.ceil(decision.resetAt / 1000));

    if (decision.allowed) return true;

    response.setHeader?.('Retry-After', decision.retryAfterSeconds);
    throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
  }

  private clientKey(request: HttpRequestLike): string {
    if (this.rateLimit.shouldTrustProxyHeaders()) {
      const forwardedFor = this.headerValue(request.headers?.['x-forwarded-for']);
      const firstForwardedFor = forwardedFor?.split(',')[0]?.trim();
      if (firstForwardedFor) return firstForwardedFor;

      const realIp = this.headerValue(request.headers?.['x-real-ip']);
      if (realIp) return realIp;
    }

    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  private headerValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0]?.trim() || undefined;
    return value?.trim() || undefined;
  }
}
