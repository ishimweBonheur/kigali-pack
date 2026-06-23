import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import {
  DEPRECATED_ENDPOINT_KEY,
  DeprecatedEndpointMeta,
} from '../decorators/deprecated-endpoint.decorator';

@Injectable()
export class DeprecationHeaderInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<DeprecatedEndpointMeta>(
      DEPRECATED_ENDPOINT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        response.setHeader('Deprecation', 'true');
        if (meta.sunset) {
          response.setHeader('Sunset', meta.sunset);
        }
        if (meta.link) {
          response.setHeader('Link', `<${meta.link}>; rel="successor-version"`);
        }
      }),
    );
  }
}
