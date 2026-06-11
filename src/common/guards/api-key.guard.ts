import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
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

    console.log('🔑 Raw Auth Header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or malformed auth header');
      throw new UnauthorizedException(
        'Access Denied: Missing or malformed credentials.',
      );
    }

    const rawToken = authHeader.split(' ')[1];
    console.log('🔑 Raw Token:', rawToken);

    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    console.log('🔒 Hashed Token:', hashedToken);

    const trackingStartTime = Date.now();

    console.log('🔍 Querying database for hash:', hashedToken);
    const keyRecord = await this.apiKeyRepo.findOne({
      where: { hashedKey: hashedToken, isActive: true },
    });

    console.log('📋 Key Record Found:', keyRecord ? 'YES' : 'NO');
    if (keyRecord) {
      console.log('👤 Developer:', keyRecord.developerName);
      console.log('🏷️ Tier:', keyRecord.tier);
    }

    if (!keyRecord) {
      console.log('❌ No matching key record found');
      throw new UnauthorizedException(
        'Access Denied: Invalid developer token credentials.',
      );
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
        console.log('📊 Telemetry logged successfully');
      } catch (logWriteError) {
        console.error('Telemetry logging failure safely caught:', logWriteError);
      }
    });

    console.log('✅ Authentication successful');
    return true;
  }
}
