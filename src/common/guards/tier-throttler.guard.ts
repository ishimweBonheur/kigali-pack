import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiKeyEntity } from '../../modules/auth/entities/api-key.entity';
import { RATE_LIMIT_HEADERS } from '../rate-limit/rate-limit.constants';
import { RateLimitService } from '../rate-limit/rate-limit.service';

@Injectable()
export class TierThrottlerGuard implements CanActivate {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ developer?: ApiKeyEntity }>();
    const response = context.switchToHttp().getResponse<Response>();
    const developer = request.developer;

    if (!developer) {
      return true;
    }

    const result = await this.rateLimitService.checkRateLimit(
      developer.id,
      developer.tier,
    );

    response.setHeader(RATE_LIMIT_HEADERS.LIMIT, String(result.limit));
    response.setHeader(
      RATE_LIMIT_HEADERS.REMAINING,
      String(result.remaining),
    );
    response.setHeader(RATE_LIMIT_HEADERS.RESET, String(result.reset));

    if (result.exceeded) {
      const retryAfterSeconds = Math.max(result.reset - Math.floor(Date.now() / 1000), 1);
      response.setHeader('Retry-After', String(retryAfterSeconds));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded for ${result.tier} plan. Retry after the current hourly window resets.`,
          tier: result.tier,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
