import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiUsageEntity } from '../../modules/analytics/entities/api-usage.entity';

@Injectable()
export class UsageMeteringService {
  private readonly logger = new Logger(UsageMeteringService.name);

  constructor(
    @InjectRepository(ApiUsageEntity)
    private readonly usageRepo: Repository<ApiUsageEntity>,
  ) {}

  private todayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async recordRequest(
    apiKeyId: string,
    endpoint: string,
    responseTimeMs: number,
    statusCode: number,
  ): Promise<void> {
    const usageDate = this.todayDateString();
    const isError = statusCode >= 400 ? 1 : 0;

    try {
      await this.usageRepo.query(
        `
        INSERT INTO api_usage_daily
          (id, api_key_id, endpoint, usage_date, requests, average_latency_ms, error_count)
        VALUES
          (uuid_generate_v4(), $1, $2, $3, 1, $4, $5)
        ON CONFLICT (api_key_id, endpoint, usage_date) DO UPDATE SET
          requests = api_usage_daily.requests + 1,
          average_latency_ms = (
            (api_usage_daily.average_latency_ms * api_usage_daily.requests) + $4
          ) / (api_usage_daily.requests + 1),
          error_count = api_usage_daily.error_count + $5
        `,
        [apiKeyId, endpoint, usageDate, responseTimeMs, isError],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Usage metering failed: ${message}`);
    }
  }
}
