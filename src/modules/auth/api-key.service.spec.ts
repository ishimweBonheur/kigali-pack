import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyEntity } from './entities/api-key.entity';
import { ApiKeyEnvironment, ApiKeyTier } from './enums/api-key.enum';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let apiKeyRepo: jest.Mocked<Repository<ApiKeyEntity>>;
  let dataSource: { transaction: jest.Mock };

  const owner: ApiKeyEntity = {
    id: 'owner-id',
    developerName: 'Test Developer',
    name: null,
    hashedKey: 'abc123',
    keyPrefix: 'kp_test_owner',
    environment: ApiKeyEnvironment.TEST,
    tier: ApiKeyTier.FREE,
    isActive: true,
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    apiKeyRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<ApiKeyEntity>>;

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: getRepositoryToken(ApiKeyEntity),
          useValue: apiKeyRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get(ApiKeyService);
  });

  describe('generateRawToken', () => {
    it('should prefix LIVE tokens with kp_live_', () => {
      const token = service.generateRawToken(ApiKeyEnvironment.LIVE);
      expect(token.startsWith('kp_live_')).toBe(true);
    });

    it('should prefix SANDBOX tokens with kp_sandbox_', () => {
      const token = service.generateRawToken(ApiKeyEnvironment.SANDBOX);
      expect(token.startsWith('kp_sandbox_')).toBe(true);
    });
  });

  describe('hashToken', () => {
    it('should produce a 64-char SHA256 hex digest', () => {
      const hash = service.hashToken('kp_test_sample');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('isKeyValid', () => {
    it('should reject revoked keys', () => {
      const key = { ...owner, revokedAt: new Date() };
      expect(service.isKeyValid(key)).toBe(false);
    });

    it('should reject expired keys', () => {
      const key = {
        ...owner,
        expiresAt: new Date(Date.now() - 60_000),
      };
      expect(service.isKeyValid(key)).toBe(false);
    });

    it('should accept active non-expired keys', () => {
      expect(service.isKeyValid(owner)).toBe(true);
    });
  });

  describe('create', () => {
    it('should return raw token once on successful creation', async () => {
      const dto: CreateApiKeyDto = {
        name: 'CI Key',
        environment: ApiKeyEnvironment.TEST,
      };

      apiKeyRepo.findOne.mockResolvedValue(null);
      apiKeyRepo.create.mockImplementation((payload) => payload as ApiKeyEntity);
      apiKeyRepo.save.mockImplementation(async (entity) => ({
        ...(entity as ApiKeyEntity),
        id: 'new-key-id',
        createdAt: new Date(),
      }));

      const result = await service.create(owner, dto);

      expect(result.rawToken).toMatch(/^kp_test_/);
      expect(result.id).toBe('new-key-id');
      expect(result.name).toBe('CI Key');
      expect(apiKeyRepo.save).toHaveBeenCalled();
    });

    it('should reject past expiration dates', async () => {
      const dto: CreateApiKeyDto = {
        environment: ApiKeyEnvironment.TEST,
        expiresAt: '2020-01-01T00:00:00.000Z',
      };

      await expect(service.create(owner, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject token hash collisions', async () => {
      apiKeyRepo.findOne.mockResolvedValue(owner);

      await expect(
        service.create(owner, { environment: ApiKeyEnvironment.TEST }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('revoke', () => {
    it('should revoke an owned key', async () => {
      const target: ApiKeyEntity = {
        ...owner,
        id: 'target-id',
      };

      apiKeyRepo.findOne.mockResolvedValue(target);
      apiKeyRepo.save.mockImplementation(async (entity) => entity as ApiKeyEntity);

      const result = await service.revoke(owner, 'target-id');

      expect(result.isActive).toBe(false);
      expect(result.revokedAt).toBeInstanceOf(Date);
    });

    it('should prevent revoking the active session key', async () => {
      apiKeyRepo.findOne.mockResolvedValue(owner);

      await expect(service.revoke(owner, owner.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when key belongs to another developer', async () => {
      apiKeyRepo.findOne.mockResolvedValue({
        ...owner,
        id: 'other-id',
        developerName: 'Other Dev',
      });

      await expect(service.revoke(owner, 'other-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listByDeveloper', () => {
    it('should return mapped DTOs without hashed keys', async () => {
      apiKeyRepo.find.mockResolvedValue([owner]);

      const result = await service.listByDeveloper('Test Developer');

      expect(result).toHaveLength(1);
      expect(result[0].keyPrefix).toBe('kp_test_owner');
      expect(result[0]).not.toHaveProperty('hashedKey');
      expect(result[0]).not.toHaveProperty('rawToken');
    });
  });
});
