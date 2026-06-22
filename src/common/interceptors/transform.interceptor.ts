import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { ApiSuccessPayload } from '../dto/api-response.dto';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{ method?: string; url?: string }>();

    return next.handle().pipe(
      map((body) => {
        if (body && typeof body === 'object' && 'success' in body) {
          return body;
        }

        const message = this.resolveMessage(request.method, body);
        const { data, meta } = this.extractDataAndMeta(body);

        return {
          success: true,
          message,
          data,
          meta,
        } satisfies ApiSuccessPayload;
      }),
    );
  }

  private resolveMessage(method?: string, body?: unknown): string {
    if (body && typeof body === 'object' && 'message' in body) {
      const msg = (body as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.length > 0) {
        return msg;
      }
    }

    switch (method?.toUpperCase()) {
      case 'POST':
        return 'Resource created successfully';
      case 'PATCH':
      case 'PUT':
        return 'Resource updated successfully';
      case 'DELETE':
        return 'Resource deleted successfully';
      default:
        return 'Request completed successfully';
    }
  }

  private extractDataAndMeta(body: unknown): {
    data: unknown;
    meta: Record<string, unknown>;
  } {
    if (body === undefined || body === null) {
      return { data: {}, meta: {} };
    }

    if (typeof body !== 'object') {
      return { data: body, meta: {} };
    }

    const record = body as Record<string, unknown>;
    const meta: Record<string, unknown> = {};

    if (record.pagination && typeof record.pagination === 'object') {
      meta.pagination = record.pagination;
    }
    if (record.period && typeof record.period === 'object') {
      meta.period = record.period;
    }
    if (record.summary && typeof record.summary === 'object') {
      meta.summary = record.summary;
    }

    const {
      pagination: _p,
      period: _pd,
      summary: _s,
      message: _m,
      ...rest
    } = record;

    if (Object.keys(rest).length === 0 && Object.keys(meta).length > 0) {
      return { data: meta.summary ?? {}, meta };
    }

    if (Object.keys(rest).length === 1 && 'data' in rest) {
      return { data: rest.data, meta };
    }

    return { data: rest, meta };
  }
}
