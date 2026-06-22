import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyEntity } from '../../modules/auth/entities/api-key.entity';
import { ApiLogEntity } from '../../modules/analytics/entities/api-log.entity';
import { ApiKeyService } from '../../modules/auth/api-key.service';
import { UsageMeteringService } from '../../modules/analytics/usage-metering.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(ApiLogEntity)
    private readonly apiLogRepo: Repository<ApiLogEntity>,
    private readonly apiKeyService: ApiKeyService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Access Denied: Missing or malformed credentials.',
      );
    }

    const rawToken = authHeader.split(' ')[1];
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const trackingStartTime = Date.now();

    const keyRecord = await this.apiKeyRepo.findOne({
      where: { hashedKey: hashedToken, isActive: true },
    });

    if (!keyRecord || !this.apiKeyService.isKeyValid(keyRecord)) {
      throw new UnauthorizedException(
        'Access Denied: Invalid, expired, or revoked developer token credentials.',
      );
    }

    request['developer'] = keyRecord;

    void this.apiKeyService.touchLastUsed(keyRecord.id).catch(() => {
      /* non-blocking last-used update */
    });

    response.on('finish', async () => {
      const executionDurationMs = Date.now() - trackingStartTime;
      const endpoint = request.route ? request.route.path : request.url;
      try {
        const logMetricsRecord = this.apiLogRepo.create({
          apiKey: keyRecord,
          endpoint,
          method: request.method,
          statusCode: response.statusCode,
          responseTimeMs: executionDurationMs,
        });
        await this.apiLogRepo.save(logMetricsRecord);
        void this.usageMeteringService
          .recordRequest(
            keyRecord.id,
            endpoint,
            executionDurationMs,
            response.statusCode,
          )
          .catch(() => {
            /* non-blocking usage metering */
          });
      } catch {
        /* telemetry failures must not affect the request */
      }
    });

    return true;
  }
}
