import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
} from '../middleware/request-id.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    const method = request.method;
    const path = request.originalUrl ?? request.url;
    const requestId = request.headers[REQUEST_ID_HEADER];
    const correlationId = request.headers[CORRELATION_ID_HEADER];

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequest(method, path, response.statusCode, startedAt, {
            requestId,
            correlationId,
          });
        },
        error: () => {
          this.logRequest(method, path, response.statusCode, startedAt, {
            requestId,
            correlationId,
          });
        },
      }),
    );
  }

  private logRequest(
    method: string,
    path: string,
    statusCode: number,
    startedAt: number,
    ids: { requestId: string | string[] | undefined; correlationId: string | string[] | undefined },
  ): void {
    const durationMs = Date.now() - startedAt;
    this.logger.log(
      JSON.stringify({
        method,
        path,
        statusCode,
        durationMs,
        requestId: ids.requestId,
        correlationId: ids.correlationId,
      }),
    );
  }
}
