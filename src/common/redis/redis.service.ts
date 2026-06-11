import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const db = this.configService.get<number>('REDIS_DB', 0);

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    void this.client.connect().catch((error: Error) => {
      this.logger.warn(
        `Redis unavailable at startup (${error.message}). Rate limiting will fail open.`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  isConnected(): boolean {
    return this.client?.status === 'ready';
  }
}
