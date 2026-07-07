import { ExecutionContext, HttpException } from '@nestjs/common';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { RateLimitService } from '../rate-limit/rate-limit.service';

describe('AuthRateLimitGuard', () => {
  let guard: AuthRateLimitGuard;
  let rateLimitService: {
    checkScopedRateLimit: jest.Mock;
  };

  beforeEach(() => {
    rateLimitService = {
      checkScopedRateLimit: jest.fn().mockResolvedValue({
        limit: 20,
        remaining: 19,
        reset: 1_700_000_000,
        exceeded: false,
        tier: 'FREE',
      }),
    };

    guard = new AuthRateLimitGuard(
      rateLimitService as unknown as RateLimitService,
    );
  });

  function createContext(request: Record<string, unknown>) {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('skips rate limiting for localhost requests', async () => {
    const context = createContext({
      ip: '127.0.0.1',
      headers: {},
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(rateLimitService.checkScopedRateLimit).not.toHaveBeenCalled();
  });

  it('enforces the rate limit for hosted requests', async () => {
    const context = createContext({
      ip: '8.8.8.8',
      headers: {},
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(rateLimitService.checkScopedRateLimit).toHaveBeenCalledWith(
      'auth:8.8.8.8',
      20,
      900,
    );
  });

  it('raises a 429 when the scoped limit is exceeded', async () => {
    rateLimitService.checkScopedRateLimit.mockResolvedValueOnce({
      limit: 20,
      remaining: 0,
      reset: 1_700_000_000,
      exceeded: true,
      tier: 'FREE',
    });

    const context = createContext({
      ip: '8.8.8.8',
      headers: {},
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});
