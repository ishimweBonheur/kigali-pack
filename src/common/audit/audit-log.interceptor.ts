import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from './audit-log.service';

const AUDITED_PREFIXES = [
  '/v1/auth',
  '/v1/billing',
  '/v1/organizations',
  '/v1/me',
  '/v1/admin',
];

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      ip?: string;
      member?: { sub?: string; email?: string };
      developer?: { id?: string; developerName?: string };
    }>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();

    const path = request.url?.split('?')[0] ?? '';
    const shouldAudit = AUDITED_PREFIXES.some((prefix) => path.startsWith(prefix));

    if (!shouldAudit) {
      return next.handle();
    }

    const started = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.auditLogService.record({
          action: `${request.method} ${path}`,
          actorId: request.member?.sub ?? request.developer?.id,
          actorEmail: request.member?.email ?? request.developer?.developerName,
          method: request.method,
          path,
          statusCode: response.statusCode ?? 200,
          durationMs: Date.now() - started,
          ip: request.ip,
        });
      }),
    );
  }
}
