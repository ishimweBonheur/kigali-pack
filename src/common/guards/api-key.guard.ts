import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyEntity } from '../../modules/auth/entities/api-key.entity';
import { ApiLogEntity } from '../../modules/analytics/entities/api-log.entity';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(ApiLogEntity)
    private readonly apiLogRepo: Repository<ApiLogEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access Denied: Missing or malformed credentials.');
    }

    const rawToken = authHeader.split(' ')[1];
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const trackingStartTime = Date.now();

    const keyRecord = await this.apiKeyRepo.findOne({
      where: { hashedKey: hashedToken, isActive: true },
    });

    if (!keyRecord) {
      throw new UnauthorizedException('Access Denied: Invalid developer token credentials.');
    }

    request['developer'] = keyRecord;

    response.on('finish', async () => {
      const executionDurationMs = Date.now() - trackingStartTime;
      try {
        const logMetricsRecord = this.apiLogRepo.create({
          apiKey: keyRecord,
          endpoint: request.route ? request.route.path : request.url,
          method: request.method,
          statusCode: response.statusCode,
          responseTimeMs: executionDurationMs,
        });
        await this.apiLogRepo.save(logMetricsRecord);
      } catch (logWriteError) {
        console.error('Telemetry logging failure safely caught:', logWriteError);
      }
    });

    return true;
  }
}