import { ApiKeyTier } from '../../modules/auth/enums/api-key.enum';

export const RATE_LIMIT_WINDOW_MS = 3_600_000;

export const RATE_LIMIT_WINDOW_SECONDS = RATE_LIMIT_WINDOW_MS / 1000;

export const RATE_LIMIT_KEY_PREFIX = 'kigali:ratelimit';

export interface TierRateLimitPolicy {
  maxRequests: number | null;
}

export const TIER_RATE_LIMIT_POLICIES: Record<ApiKeyTier, TierRateLimitPolicy> =
  {
    [ApiKeyTier.FREE]: { maxRequests: 100 },
    [ApiKeyTier.PRO]: { maxRequests: 10_000 },
    [ApiKeyTier.ENTERPRISE]: { maxRequests: null },
  };

export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
} as const;
