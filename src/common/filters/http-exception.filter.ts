import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorPayload } from '../dto/api-response.dto';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const body = exceptionResponse as Record<string, unknown>;
        const rawMessage = body.message;

        if (Array.isArray(rawMessage)) {
          message = rawMessage.join('; ');
          code = 'VALIDATION_ERROR';
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        }

        if (
          code !== 'VALIDATION_ERROR' &&
          typeof body.error === 'string' &&
          status === HttpStatus.BAD_REQUEST
        ) {
          code = body.error.toUpperCase().replace(/\s+/g, '_');
        }
      }

      code = this.mapStatusToCode(status, code);
    } else if (exception instanceof Error) {
      message = 'An unexpected error occurred';
      this.logger.error(
        JSON.stringify({
          message: exception.message,
          stack: exception.stack,
          requestId: request.headers[REQUEST_ID_HEADER],
          path: request.originalUrl ?? request.url,
          method: request.method,
        }),
      );
    }

    const requestId = request.headers[REQUEST_ID_HEADER];
    if (typeof requestId === 'string') {
      response.setHeader(REQUEST_ID_HEADER, requestId);
    }

    const payload: ApiErrorPayload = {
      success: false,
      error: { code, message },
    };

    response.status(status).json(payload);
  }

  private mapStatusToCode(status: number, fallback: string): string {
    if (fallback === 'VALIDATION_ERROR') {
      return fallback;
    }

    const map: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
    };
    return map[status] ?? fallback;
  }
}
