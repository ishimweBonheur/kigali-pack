import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { ApiKeyTier } from '../../modules/auth/enums/api-key.enum';
import { ApiKeyEntity } from '../../modules/auth/entities/api-key.entity';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from '../redis/redis.service';
import { RATE_LIMIT_WINDOW_MS } from './rate-limit.constants';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let redisService: {
    getClient: jest.Mock;
    isConnected: jest.Mock;
  };

  beforeEach(async () => {
    redisService = {
      getClient: jest.fn(),
      isConnected: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: RedisService,
          useValue: redisService,
        },
      ],
    }).compile();

    service = module.get(RateLimitService);
  });

  describe('resolveTierPolicy', () => {
    it('should map FREE tier to 100 requests per hour', () => {
      const policy = service.resolveTierPolicy(ApiKeyTier.FREE);
      expect(policy.tier).toBe(ApiKeyTier.FREE);
      expect(policy.maxRequests).toBe(100);
    });

    it('should map PRO tier to 10,000 requests per hour', () => {
      const policy = service.resolveTierPolicy(ApiKeyTier.PRO);
      expect(policy.tier).toBe(ApiKeyTier.PRO);
      expect(policy.maxRequests).toBe(10_000);
    });

    it('should map ENTERPRISE tier to unlimited', () => {
      const policy = service.resolveTierPolicy(ApiKeyTier.ENTERPRISE);
      expect(policy.tier).toBe(ApiKeyTier.ENTERPRISE);
      expect(policy.maxRequests).toBeNull();
    });

    it('should default unknown tiers to FREE', () => {
      const policy = service.resolveTierPolicy('STARTER');
      expect(policy.tier).toBe(ApiKeyTier.FREE);
      expect(policy.maxRequests).toBe(100);
    });
  });

  describe('buildWindowResetTimestamp', () => {
    it('should return the next hourly boundary in unix seconds', () => {
      const nowMs = 1_700_000_000_000;
      const windowStartMs =
        Math.floor(nowMs / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
      const expectedReset = Math.floor(
        (windowStartMs + RATE_LIMIT_WINDOW_MS) / 1000,
      );

      expect(service.buildWindowResetTimestamp(nowMs)).toBe(expectedReset);
    });
  });

  describe('checkRateLimit', () => {
    it('should bypass Redis for ENTERPRISE tier', async () => {
      const result = await service.checkRateLimit('key-id', ApiKeyTier.ENTERPRISE);

      expect(result.exceeded).toBe(false);
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
      expect(redisService.getClient).not.toHaveBeenCalled();
    });

    it('should fail open when Redis is unavailable', async () => {
      redisService.getClient.mockReturnValue(null);
      redisService.isConnected.mockReturnValue(false);

      const result = await service.checkRateLimit('key-id', ApiKeyTier.FREE);

      expect(result.exceeded).toBe(false);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(100);
    });

    it('should increment Redis counter and detect exceeded limits', async () => {
      const evalMock = jest.fn().mockResolvedValue(101);
      redisService.getClient.mockReturnValue({ eval: evalMock });
      redisService.isConnected.mockReturnValue(true);

      const result = await service.checkRateLimit('key-id', ApiKeyTier.FREE);

      expect(evalMock).toHaveBeenCalled();
      expect(result.exceeded).toBe(true);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(100);
    });

    it('should return remaining quota when under the limit', async () => {
      const evalMock = jest.fn().mockResolvedValue(42);
      redisService.getClient.mockReturnValue({ eval: evalMock });
      redisService.isConnected.mockReturnValue(true);

      const result = await service.checkRateLimit('key-id', ApiKeyTier.PRO);

      expect(result.exceeded).toBe(false);
      expect(result.remaining).toBe(9_958);
      expect(result.limit).toBe(10_000);
    });
  });
});
