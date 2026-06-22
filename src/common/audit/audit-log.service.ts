import { Injectable, Logger } from '@nestjs/common';

export interface AuditLogEntry {
  action: string;
  actorId?: string;
  actorEmail?: string;
  resource?: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger('AuditLog');

  record(entry: AuditLogEntry): void {
    this.logger.log(
      JSON.stringify({
        ...entry,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
