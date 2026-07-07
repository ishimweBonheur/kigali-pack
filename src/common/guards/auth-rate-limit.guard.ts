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

interface AuthRateLimitRequest {
  ip?: string;
  hostname?: string;
  headers: Record<string, string | string[] | undefined>;
  connection?: {
    remoteAddress?: string;
  };
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRateLimitRequest>();

    if (this.isLocalhostRequest(request)) {
      return true;
    }

    const forwarded = request.headers['x-forwarded-for'];
    const forwardedValue =
      typeof forwarded === 'string' ? forwarded : forwarded?.[0];
    const clientIp =
      forwardedValue?.split(',')[0]?.trim() ?? request.ip ?? 'unknown';

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

  private isLocalhostRequest(request: AuthRateLimitRequest): boolean {
    const candidates = [
      request.ip,
      request.hostname,
      request.connection?.remoteAddress,
      request.headers['x-forwarded-for'],
      request.headers['x-real-ip'],
    ];

    const normalizedCandidates = candidates.flatMap((candidate) => {
      if (typeof candidate === 'string') {
        return candidate.split(',').map((value) => value.trim());
      }
      if (Array.isArray(candidate)) {
        return candidate.map((value) => value.trim());
      }
      return [];
    });

    return normalizedCandidates.some((candidate) => {
      if (!candidate) {
        return false;
      }

      return (
        candidate === 'localhost' ||
        candidate === '127.0.0.1' ||
        candidate === '::1' ||
        candidate.startsWith('127.') ||
        candidate.startsWith('::ffff:127.')
      );
    });
  }
}
