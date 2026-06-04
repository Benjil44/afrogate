import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA_KEY = 'afrows:rate-limit';

export interface RateLimitOptions {
  key: string;
  max: number;
  windowMs: number;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_METADATA_KEY, options);
