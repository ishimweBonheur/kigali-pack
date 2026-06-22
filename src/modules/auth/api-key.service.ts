import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKeyEntity } from './entities/api-key.entity';
import { ApiKeyEnvironment, ApiKeyTier } from './enums/api-key.enum';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import {
  ApiKeyResponseDto,
  CreateApiKeyResponseDto,
  RotateApiKeyResponseDto,
} from './dto/api-key-response.dto';

const ENVIRONMENT_PREFIX: Record<ApiKeyEnvironment, string> = {
  [ApiKeyEnvironment.LIVE]: 'kp_live_',
  [ApiKeyEnvironment.TEST]: 'kp_test_',
  [ApiKeyEnvironment.SANDBOX]: 'kp_sandbox_',
};

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    private readonly dataSource: DataSource,
  ) {}

  generateRawToken(environment: ApiKeyEnvironment): string {
    const prefix = ENVIRONMENT_PREFIX[environment];
    const entropy = crypto.randomBytes(24).toString('hex');
    return `${prefix}${entropy}`;
  }

  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  extractKeyPrefix(rawToken: string): string {
    return rawToken.slice(0, 16);
  }

  toResponseDto(entity: ApiKeyEntity): ApiKeyResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      keyPrefix: entity.keyPrefix,
      environment: entity.environment,
      tier: entity.tier,
      isActive: entity.isActive,
      expiresAt: entity.expiresAt,
      lastUsedAt: entity.lastUsedAt,
      revokedAt: entity.revokedAt,
      createdAt: entity.createdAt,
    };
  }

  async create(
    owner: ApiKeyEntity,
    dto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponseDto> {
    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('expiresAt must be a future timestamp');
    }

    const rawToken = this.generateRawToken(dto.environment);
    const hashedKey = this.hashToken(rawToken);

    const existing = await this.apiKeyRepo.findOne({ where: { hashedKey } });
    if (existing) {
      throw new ConflictException(
        'Token collision detected — please retry creation',
      );
    }

    const entity = this.apiKeyRepo.create({
      developerName: owner.developerName,
      name: dto.name ?? null,
      hashedKey,
      keyPrefix: this.extractKeyPrefix(rawToken),
      environment: dto.environment,
      tier: owner.tier,
      isActive: true,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    const saved = await this.apiKeyRepo.save(entity);

    return {
      ...this.toResponseDto(saved),
      rawToken,
    };
  }

  async listByDeveloper(developerName: string): Promise<ApiKeyResponseDto[]> {
    const keys = await this.apiKeyRepo.find({
      where: { developerName },
      order: { createdAt: 'DESC' },
    });

    return keys.map((key) => this.toResponseDto(key));
  }

  async revoke(
    owner: ApiKeyEntity,
    keyId: string,
  ): Promise<ApiKeyResponseDto> {
    const key = await this.findOwnedKey(owner, keyId);

    if (!key.isActive || key.revokedAt) {
      throw new BadRequestException('API key is already revoked');
    }

    if (key.id === owner.id) {
      throw new BadRequestException(
        'Cannot revoke the API key currently in use — authenticate with a different key',
      );
    }

    key.isActive = false;
    key.revokedAt = new Date();

    const saved = await this.apiKeyRepo.save(key);
    return this.toResponseDto(saved);
  }

  async rotate(
    owner: ApiKeyEntity,
    keyId: string,
  ): Promise<RotateApiKeyResponseDto> {
    const key = await this.findOwnedKey(owner, keyId);

    if (!key.isActive || key.revokedAt) {
      throw new BadRequestException('Cannot rotate a revoked API key');
    }

    return this.dataSource.transaction(async (manager) => {
      const keyRepo = manager.getRepository(ApiKeyEntity);

      key.isActive = false;
      key.revokedAt = new Date();
      await keyRepo.save(key);

      const rawToken = this.generateRawToken(key.environment);
      const hashedKey = this.hashToken(rawToken);

      const replacement = keyRepo.create({
        developerName: key.developerName,
        name: key.name,
        hashedKey,
        keyPrefix: this.extractKeyPrefix(rawToken),
        environment: key.environment,
        tier: key.tier,
        isActive: true,
        expiresAt: key.expiresAt,
      });

      const saved = await keyRepo.save(replacement);

      return {
        ...this.toResponseDto(saved),
        rawToken,
        newKeyId: saved.id,
        revokedKeyId: key.id,
      };
    });
  }

  async touchLastUsed(keyId: string): Promise<void> {
    await this.apiKeyRepo.update(keyId, { lastUsedAt: new Date() });
  }

  isKeyValid(key: ApiKeyEntity): boolean {
    if (!key.isActive || key.revokedAt) {
      return false;
    }
    if (key.expiresAt && key.expiresAt <= new Date()) {
      return false;
    }
    return true;
  }

  async ensureDefaultKeyForOrganization(
    developerName: string,
    label = 'Default',
  ): Promise<ApiKeyEntity> {
    const existing = await this.apiKeyRepo.findOne({
      where: { developerName, isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (existing && this.isKeyValid(existing)) {
      return existing;
    }

    const rawToken = this.generateRawToken(ApiKeyEnvironment.TEST);
    const entity = this.apiKeyRepo.create({
      developerName,
      name: label,
      hashedKey: this.hashToken(rawToken),
      keyPrefix: this.extractKeyPrefix(rawToken),
      environment: ApiKeyEnvironment.TEST,
      tier: ApiKeyTier.FREE,
      isActive: true,
      expiresAt: null,
    });

    return this.apiKeyRepo.save(entity);
  }

  private async findOwnedKey(
    owner: ApiKeyEntity,
    keyId: string,
  ): Promise<ApiKeyEntity> {
    const key = await this.apiKeyRepo.findOne({ where: { id: keyId } });

    if (!key || key.developerName !== owner.developerName) {
      throw new NotFoundException(`API key ${keyId} not found`);
    }

    return key;
  }
}
