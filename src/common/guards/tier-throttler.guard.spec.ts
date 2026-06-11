import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { ApiKeyTier } from '../../modules/auth/enums/api-key.enum';
import { ApiKeyEntity } from '../../modules/auth/entities/api-key.entity';
import { TierThrottlerGuard } from './tier-throttler.guard';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { RATE_LIMIT_HEADERS } from '../rate-limit/rate-limit.constants';

describe('TierThrottlerGuard', () => {
  let guard: TierThrottlerGuard;
  let rateLimitService: {
    checkRateLimit: jest.Mock;
  };

  const developer: ApiKeyEntity = {
    id: 'developer-key-id',
    developerName: 'Test Developer',
    name: null,
    hashedKey: 'hash',
    keyPrefix: 'kp_test_dev',
    environment: 'TEST' as ApiKeyEntity['environment'],
    tier: ApiKeyTier.FREE,
    isActive: true,
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createExecutionContext = (
    requestDeveloper?: ApiKeyEntity,
  ): ExecutionContext => {
    const headers: Record<string, string> = {};
    const response = {
      setHeader: jest.fn((name: string, value: string) => {
        headers[name] = value;
      }),
      getHeader: (name: string) => headers[name],
    };

    const request = {
      developer: requestDeveloper,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    rateLimitService = {
      checkRateLimit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TierThrottlerGuard,
        {
          provide: RateLimitService,
          useValue: rateLimitService,
        },
      ],
    }).compile();

    guard = module.get(TierThrottlerGuard);
  });

  it('should allow requests without an authenticated developer context', async () => {
    const context = createExecutionContext(undefined);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(rateLimitService.checkRateLimit).not.toHaveBeenCalled();
  });

  it('should set rate limit headers and allow requests under the limit', async () => {
    rateLimitService.checkRateLimit.mockResolvedValue({
      limit: 100,
      remaining: 87,
      reset: 1_700_003_600,
      exceeded: false,
      tier: ApiKeyTier.FREE,
    });

    const context = createExecutionContext(developer);
    const response = context.switchToHttp().getResponse<{ setHeader: jest.Mock }>();

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
      developer.id,
      developer.tier,
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      RATE_LIMIT_HEADERS.LIMIT,
      '100',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      RATE_LIMIT_HEADERS.REMAINING,
      '87',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      RATE_LIMIT_HEADERS.RESET,
      '1700003600',
    );
  });

  it('should throw 429 when the rate limit is exceeded', async () => {
    rateLimitService.checkRateLimit.mockResolvedValue({
      limit: 100,
      remaining: 0,
      reset: 1_700_003_600,
      exceeded: true,
      tier: ApiKeyTier.FREE,
    });

    const context = createExecutionContext(developer);
    const response = context.switchToHttp().getResponse<{ setHeader: jest.Mock }>();

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('should include tier metadata in the 429 payload', async () => {
    rateLimitService.checkRateLimit.mockResolvedValue({
      limit: 10_000,
      remaining: 0,
      reset: 1_700_003_600,
      exceeded: true,
      tier: ApiKeyTier.PRO,
    });

    const context = createExecutionContext({
      ...developer,
      tier: ApiKeyTier.PRO,
    });

    try {
      await guard.canActivate(context);
      fail('Expected guard to throw HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(httpError.getResponse()).toMatchObject({
        tier: ApiKeyTier.PRO,
        limit: 10_000,
      });
    }
  });
});
