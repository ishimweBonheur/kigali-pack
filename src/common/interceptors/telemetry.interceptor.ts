import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, tap } from 'rxjs';
import { ApiLogEntity } from '../../modules/analytics/entities/api-log.entity';
import { ApiKeyEntity } from '../../modules/auth/entities/api-key.entity';
import { UsageMeteringService } from '../../modules/analytics/usage-metering.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TRANSIENT_PROCESSING_KEY } from '../decorators/transient-processing.decorator';
import { isTransientRoute } from '../constants/data-retention.constants';
import { createMaskedPayloadSnapshot } from '../utils/pii-redaction.util';

interface TelemetryRequest {
  route?: { path: string };
  url: string;
  method: string;
  body?: unknown;
  developer?: ApiKeyEntity;
  telemetryStartMs?: number;
  telemetryResponseBody?: unknown;
}

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(ApiLogEntity)
    private readonly apiLogRepo: Repository<ApiLogEntity>,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<TelemetryRequest>();
    const response = context.switchToHttp().getResponse<{
      statusCode: number;
      on: (event: string, listener: () => void) => void;
    }>();

    const routePath = request.route
      ? request.route.path
      : request.url.split('?')[0];

    // Avoid recursive telemetry when listing logs
    if (routePath.includes('/v1/developer/analytics/logs')) {
      return next.handle();
    }

    request.telemetryStartMs = Date.now();

    const handlerTransient = this.reflector.getAllAndOverride<boolean>(
      TRANSIENT_PROCESSING_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isTransient = handlerTransient || isTransientRoute(routePath);
    const requestBodySnapshot = request.body ?? {};

    response.on('finish', () => {
      const developer = request.developer;
      if (!developer) {
        return;
      }

      const executionTimeMs =
        Date.now() - (request.telemetryStartMs ?? Date.now());
      const maskedSnapshot = createMaskedPayloadSnapshot(
        requestBodySnapshot,
        request.telemetryResponseBody,
        isTransient,
      );

      void this.persistMetadataAudit({
        developer,
        httpMethod: request.method,
        routePath,
        httpStatusCode: response.statusCode,
        executionTimeMs,
        maskedRequestSnapshot: maskedSnapshot.request,
        maskedResponseSnapshot: maskedSnapshot.response,
        processingMode: isTransient ? 'transient' : 'stateful',
      }).catch(() => {
        /* telemetry failures must not affect the request */
      });
    });

    return next.handle().pipe(
      tap((responseBody) => {
        request.telemetryResponseBody = responseBody;
      }),
    );
  }

  private async persistMetadataAudit(params: {
    developer: ApiKeyEntity;
    httpMethod: string;
    routePath: string;
    httpStatusCode: number;
    executionTimeMs: number;
    maskedRequestSnapshot: string;
    maskedResponseSnapshot: string;
    processingMode: 'transient' | 'stateful';
  }): Promise<void> {
    const logRecord = this.apiLogRepo.create({
      apiKey: params.developer,
      developerId: params.developer.id,
      endpoint: params.routePath,
      method: params.httpMethod,
      statusCode: params.httpStatusCode,
      responseTimeMs: params.executionTimeMs,
      maskedRequestSnapshot: params.maskedRequestSnapshot,
      maskedResponseSnapshot: params.maskedResponseSnapshot,
      processingMode: params.processingMode,
    });

    await this.apiLogRepo.save(logRecord);

    void this.usageMeteringService
      .recordRequest(
        params.developer.id,
        params.routePath,
        params.executionTimeMs,
        params.httpStatusCode,
      )
      .catch(() => {
        /* non-blocking usage metering */
      });
  }
}
