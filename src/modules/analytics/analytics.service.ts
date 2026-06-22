import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiUsageEntity } from './entities/api-usage.entity';
import { ApiLogEntity } from './entities/api-log.entity';
import { AnalyticsQueryDto } from '../../common/dto/pagination-query.dto';
import {
  ApiLogDetail,
  ApiLogListItem,
  ApiLogsQueryDto,
} from './dto/api-logs.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(ApiUsageEntity)
    private readonly usageRepo: Repository<ApiUsageEntity>,
    @InjectRepository(ApiLogEntity)
    private readonly logRepo: Repository<ApiLogEntity>,
  ) {}

  private defaultDateRange(query: AnalyticsQueryDto): { from: string; to: string } {
    const to = query.to ?? new Date().toISOString().slice(0, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const from = query.from ?? fromDate.toISOString().slice(0, 10);
    return { from, to };
  }

  async getSummary(apiKeyId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.defaultDateRange(query);

    const [usageSummary, endpointCountResult, errorLogCount, topEndpoints] =
      await Promise.all([
        this.usageRepo
          .createQueryBuilder('usage')
          .select('COALESCE(SUM(usage.requests), 0)', 'totalRequests')
          .addSelect('COALESCE(SUM(usage.error_count), 0)', 'totalErrors')
          .addSelect(
            'SUM(usage.average_latency_ms * usage.requests) / NULLIF(SUM(usage.requests), 0)',
            'averageLatencyMs',
          )
          .where('usage.api_key_id = :apiKeyId', { apiKeyId })
          .andWhere('usage.usage_date BETWEEN :from AND :to', { from, to })
          .getRawOne<{
            totalRequests: string;
            totalErrors: string;
            averageLatencyMs: string | null;
          }>(),
        this.usageRepo
          .createQueryBuilder('usage')
          .select('COUNT(DISTINCT usage.endpoint)', 'endpointCount')
          .where('usage.api_key_id = :apiKeyId', { apiKeyId })
          .andWhere('usage.usage_date BETWEEN :from AND :to', { from, to })
          .getRawOne<{ endpointCount: string }>(),
        this.logRepo
          .createQueryBuilder('log')
          .select('COUNT(*)', 'recentErrorCount')
          .where('log.api_key_id = :apiKeyId', { apiKeyId })
          .andWhere('log.status_code >= 400')
          .andWhere('log.timestamp::date BETWEEN :from::date AND :to::date', {
            from,
            to,
          })
          .getRawOne<{ recentErrorCount: string }>(),
        this.usageRepo
          .createQueryBuilder('usage')
          .select('usage.endpoint', 'endpoint')
          .addSelect('SUM(usage.requests)', 'requests')
          .where('usage.api_key_id = :apiKeyId', { apiKeyId })
          .andWhere('usage.usage_date BETWEEN :from AND :to', { from, to })
          .groupBy('usage.endpoint')
          .orderBy('SUM(usage.requests)', 'DESC')
          .limit(5)
          .getRawMany<{ endpoint: string; requests: string }>(),
      ]);

    const totalRequests = Number(usageSummary?.totalRequests ?? 0);
    const totalErrors = Number(usageSummary?.totalErrors ?? 0);

    return {
      period: { from, to },
      summary: {
        totalRequests,
        totalErrors,
        errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
        averageLatencyMs: Math.round(
          Number(usageSummary?.averageLatencyMs ?? 0),
        ),
        uniqueEndpoints: Number(endpointCountResult?.endpointCount ?? 0),
        recentErrorLogs: Number(errorLogCount?.recentErrorCount ?? 0),
      },
      topEndpoints: topEndpoints.map((row) => ({
        endpoint: row.endpoint,
        requests: Number(row.requests),
      })),
    };
  }

  async getUsage(apiKeyId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.defaultDateRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [rows, total] = await this.usageRepo
      .createQueryBuilder('usage')
      .where('usage.api_key_id = :apiKeyId', { apiKeyId })
      .andWhere('usage.usage_date BETWEEN :from AND :to', { from, to })
      .orderBy('usage.usage_date', 'DESC')
      .addOrderBy('usage.requests', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const summary = await this.usageRepo
      .createQueryBuilder('usage')
      .select('COALESCE(SUM(usage.requests), 0)', 'totalRequests')
      .addSelect('COALESCE(SUM(usage.error_count), 0)', 'totalErrors')
      .where('usage.api_key_id = :apiKeyId', { apiKeyId })
      .andWhere('usage.usage_date BETWEEN :from AND :to', { from, to })
      .getRawOne<{ totalRequests: string; totalErrors: string }>();

    return {
      period: { from, to },
      summary: {
        totalRequests: Number(summary?.totalRequests ?? 0),
        totalErrors: Number(summary?.totalErrors ?? 0),
      },
      pagination: { page, limit, total },
      data: rows.map((row) => ({
        endpoint: row.endpoint,
        date: row.usageDate,
        requests: row.requests,
        averageLatencyMs: Number(row.averageLatencyMs),
        errorCount: row.errorCount,
      })),
    };
  }

  async getErrors(apiKeyId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.defaultDateRange(query);

    const dailyErrors = await this.usageRepo
      .createQueryBuilder('usage')
      .select('usage.usage_date', 'date')
      .addSelect('SUM(usage.error_count)', 'errorCount')
      .addSelect('SUM(usage.requests)', 'totalRequests')
      .where('usage.api_key_id = :apiKeyId', { apiKeyId })
      .andWhere('usage.usage_date BETWEEN :from AND :to', { from, to })
      .groupBy('usage.usage_date')
      .orderBy('usage.usage_date', 'DESC')
      .getRawMany<{ date: string; errorCount: string; totalRequests: string }>();

    const recentErrors = await this.logRepo
      .createQueryBuilder('log')
      .where('log.api_key_id = :apiKeyId', { apiKeyId })
      .andWhere('log.status_code >= 400')
      .andWhere('log.timestamp::date BETWEEN :from::date AND :to::date', {
        from,
        to,
      })
      .orderBy('log.timestamp', 'DESC')
      .limit(50)
      .getMany();

    return {
      period: { from, to },
      dailyBreakdown: dailyErrors.map((row) => ({
        date: row.date,
        errorCount: Number(row.errorCount),
        totalRequests: Number(row.totalRequests),
        errorRate:
          Number(row.totalRequests) > 0
            ? Number(row.errorCount) / Number(row.totalRequests)
            : 0,
      })),
      recentErrors: recentErrors.map((log) => ({
        endpoint: log.endpoint,
        method: log.method,
        statusCode: log.statusCode,
        responseTimeMs: log.responseTimeMs,
        timestamp: log.timestamp,
      })),
    };
  }

  async getLatency(apiKeyId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.defaultDateRange(query);

    const endpointLatency = await this.usageRepo
      .createQueryBuilder('usage')
      .select('usage.endpoint', 'endpoint')
      .addSelect('AVG(usage.average_latency_ms)', 'averageLatencyMs')
      .addSelect('SUM(usage.requests)', 'requests')
      .where('usage.api_key_id = :apiKeyId', { apiKeyId })
      .andWhere('usage.usage_date BETWEEN :from AND :to', { from, to })
      .groupBy('usage.endpoint')
      .orderBy('AVG(usage.average_latency_ms)', 'DESC')
      .getRawMany<{
        endpoint: string;
        averageLatencyMs: string;
        requests: string;
      }>();

    const dailyLatency = await this.usageRepo
      .createQueryBuilder('usage')
      .select('usage.usage_date', 'date')
      .addSelect(
        'SUM(usage.average_latency_ms * usage.requests) / NULLIF(SUM(usage.requests), 0)',
        'weightedAverageMs',
      )
      .where('usage.api_key_id = :apiKeyId', { apiKeyId })
      .andWhere('usage.usage_date BETWEEN :from AND :to', { from, to })
      .groupBy('usage.usage_date')
      .orderBy('usage.usage_date', 'ASC')
      .getRawMany<{ date: string; weightedAverageMs: string | null }>();

    return {
      period: { from, to },
      byEndpoint: endpointLatency.map((row) => ({
        endpoint: row.endpoint,
        averageLatencyMs: Math.round(Number(row.averageLatencyMs)),
        requests: Number(row.requests),
      })),
      dailyTrend: dailyLatency.map((row) => ({
        date: row.date,
        averageLatencyMs: Math.round(Number(row.weightedAverageMs ?? 0)),
      })),
    };
  }

  async getEndpoints(apiKeyId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.defaultDateRange(query);

    const endpoints = await this.usageRepo
      .createQueryBuilder('usage')
      .select('usage.endpoint', 'endpoint')
      .addSelect('SUM(usage.requests)', 'requests')
      .addSelect('SUM(usage.error_count)', 'errors')
      .addSelect(
        'SUM(usage.average_latency_ms * usage.requests) / NULLIF(SUM(usage.requests), 0)',
        'averageLatencyMs',
      )
      .where('usage.api_key_id = :apiKeyId', { apiKeyId })
      .andWhere('usage.usage_date BETWEEN :from AND :to', { from, to })
      .groupBy('usage.endpoint')
      .orderBy('SUM(usage.requests)', 'DESC')
      .getRawMany<{
        endpoint: string;
        requests: string;
        errors: string;
        averageLatencyMs: string | null;
      }>();

    return {
      period: { from, to },
      endpoints: endpoints.map((row) => ({
        endpoint: row.endpoint,
        requests: Number(row.requests),
        errors: Number(row.errors),
        averageLatencyMs: Math.round(Number(row.averageLatencyMs ?? 0)),
        successRate:
          Number(row.requests) > 0
            ? (Number(row.requests) - Number(row.errors)) / Number(row.requests)
            : 1,
      })),
    };
  }

  async listLogs(apiKeyId: string, query: ApiLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const qb = this.logRepo
      .createQueryBuilder('log')
      .where('log.api_key_id = :apiKeyId', { apiKeyId })
      .orderBy('log.timestamp', 'DESC');

    if (query.method) {
      qb.andWhere('log.method = :method', { method: query.method.toUpperCase() });
    }

    if (query.statusCode) {
      qb.andWhere('log.status_code = :statusCode', {
        statusCode: query.statusCode,
      });
    }

    qb.skip(offset).take(limit);

    const [logs, total] = await qb.getManyAndCount();

    return {
      pagination: { page, limit, total },
      data: logs.map((log) => this.toLogListItem(log)),
    };
  }

  async getLogById(apiKeyId: string, logId: string): Promise<ApiLogDetail> {
    const log = await this.logRepo.findOne({
      where: { id: logId, apiKey: { id: apiKeyId } },
      relations: { apiKey: true },
    });

    if (!log) {
      throw new NotFoundException(`Log record ${logId} not found`);
    }

    return {
      ...this.toLogListItem(log),
      apiKeyId: log.apiKey.id,
    };
  }

  private toLogListItem(log: ApiLogEntity): ApiLogListItem {
    return {
      id: log.id,
      method: log.method,
      routePath: log.endpoint,
      httpStatusCode: log.statusCode,
      executionTimeMs: log.responseTimeMs,
      clientIp: null,
      maskedPayloadSnapshot: {
        request: '[REDACTED — request body not persisted]',
        response: '[REDACTED — response body not persisted]',
      },
      createdAt: log.timestamp,
    };
  }
}
