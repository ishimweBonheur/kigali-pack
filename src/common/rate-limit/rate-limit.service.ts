import { Injectable, Logger } from '@nestjs/common';
import { ApiKeyTier } from '../../modules/auth/enums/api-key.enum';
import { RedisService } from '../redis/redis.service';
import {
  RATE_LIMIT_KEY_PREFIX,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_WINDOW_SECONDS,
  TIER_RATE_LIMIT_POLICIES,
} from './rate-limit.constants';

export interface RateLimitCheckResult {
  limit: number;
  remaining: number;
  reset: number;
  exceeded: boolean;
  tier: ApiKeyTier;
}

const INCREMENT_WITH_EXPIRE_SCRIPT = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`;

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly redisService: RedisService) {}

  resolveTierPolicy(tier: string | undefined): {
    tier: ApiKeyTier;
    maxRequests: number | null;
  } {
    const normalizedTier = (
      tier ?? ApiKeyTier.FREE
    ).toUpperCase() as ApiKeyTier;
    const policy =
      TIER_RATE_LIMIT_POLICIES[normalizedTier] ??
      TIER_RATE_LIMIT_POLICIES[ApiKeyTier.FREE];

    const resolvedTier = TIER_RATE_LIMIT_POLICIES[normalizedTier]
      ? normalizedTier
      : ApiKeyTier.FREE;

    return {
      tier: resolvedTier,
      maxRequests: policy.maxRequests,
    };
  }

  buildWindowResetTimestamp(nowMs = Date.now()): number {
    const windowStartMs =
      Math.floor(nowMs / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
    return Math.floor((windowStartMs + RATE_LIMIT_WINDOW_MS) / 1000);
  }

  buildRateLimitKey(apiKeyId: string, nowMs = Date.now()): string {
    const windowId = Math.floor(nowMs / RATE_LIMIT_WINDOW_MS);
    return `${RATE_LIMIT_KEY_PREFIX}:${apiKeyId}:${windowId}`;
  }

  async checkScopedRateLimit(
    scopeKey: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<RateLimitCheckResult> {
    const reset = Math.floor(Date.now() / 1000) + windowSeconds;
    const client = this.redisService.getClient();

    if (!client || !this.redisService.isConnected()) {
      this.logger.warn(
        `Redis unavailable — allowing scoped request for scope=${scopeKey}`,
      );
      return {
        limit: maxRequests,
        remaining: maxRequests,
        reset,
        exceeded: false,
        tier: ApiKeyTier.FREE,
      };
    }

    const redisKey = `${RATE_LIMIT_KEY_PREFIX}:scope:${scopeKey}`;

    try {
      const currentCount = Number(
        await client.eval(
          INCREMENT_WITH_EXPIRE_SCRIPT,
          1,
          redisKey,
          windowSeconds,
        ),
      );

      return {
        limit: maxRequests,
        remaining: Math.max(maxRequests - currentCount, 0),
        reset,
        exceeded: currentCount > maxRequests,
        tier: ApiKeyTier.FREE,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Scoped rate limit check failed for scope=${scopeKey}: ${message}. Failing open.`,
      );
      return {
        limit: maxRequests,
        remaining: maxRequests,
        reset,
        exceeded: false,
        tier: ApiKeyTier.FREE,
      };
    }
  }

  async checkRateLimit(
    apiKeyId: string,
    tier: string | undefined,
  ): Promise<RateLimitCheckResult> {
    const { tier: resolvedTier, maxRequests } = this.resolveTierPolicy(tier);
    const reset = this.buildWindowResetTimestamp();

    if (maxRequests === null) {
      return {
        limit: 0,
        remaining: 0,
        reset,
        exceeded: false,
        tier: resolvedTier,
      };
    }

    const client = this.redisService.getClient();
    if (!client || !this.redisService.isConnected()) {
      this.logger.warn(
        `Redis unavailable — allowing request for apiKeyId=${apiKeyId}`,
      );
      return {
        limit: maxRequests,
        remaining: maxRequests,
        reset,
        exceeded: false,
        tier: resolvedTier,
      };
    }

    const redisKey = this.buildRateLimitKey(apiKeyId);

    try {
      const currentCount = Number(
        await client.eval(
          INCREMENT_WITH_EXPIRE_SCRIPT,
          1,
          redisKey,
          RATE_LIMIT_WINDOW_SECONDS,
        ),
      );

      const remaining = Math.max(maxRequests - currentCount, 0);

      return {
        limit: maxRequests,
        remaining,
        reset,
        exceeded: currentCount > maxRequests,
        tier: resolvedTier,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Rate limit check failed for apiKeyId=${apiKeyId}: ${message}. Failing open.`,
      );
      return {
        limit: maxRequests,
        remaining: maxRequests,
        reset,
        exceeded: false,
        tier: resolvedTier,
      };
    }
  }
}
