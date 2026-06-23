import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RateLimitService } from '../rate-limit/rate-limit.service';

const AUTH_RATE_LIMIT = 20;
const AUTH_WINDOW_SECONDS = 900;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    }>();

    const forwarded = request.headers['x-forwarded-for'];
    const clientIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null) ??
      request.ip ??
      'unknown';

    const result = await this.rateLimitService.checkScopedRateLimit(
      `auth:${clientIp}`,
      AUTH_RATE_LIMIT,
      AUTH_WINDOW_SECONDS,
    );

    const response = context.switchToHttp().getResponse<{
      setHeader: (name: string, value: string | number) => void;
    }>();

    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', result.reset);

    if (result.exceeded) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many authentication attempts. Please try again later.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
