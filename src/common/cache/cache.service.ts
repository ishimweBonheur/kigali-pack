import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly prefix = 'kigali:cache:';

  constructor(private readonly redisService: RedisService) {}

  private buildKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const client = this.redisService.getClient();
    if (!client || !this.redisService.isConnected()) {
      return null;
    }

    try {
      const raw = await client.get(this.buildKey(key));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(`Cache get failed for ${key}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    const client = this.redisService.getClient();
    if (!client || !this.redisService.isConnected()) {
      return;
    }

    try {
      await client.set(
        this.buildKey(key),
        JSON.stringify(value),
        'EX',
        ttlSeconds,
      );
    } catch (error) {
      this.logger.warn(`Cache set failed for ${key}`);
    }
  }

  async del(key: string): Promise<void> {
    const client = this.redisService.getClient();
    if (!client || !this.redisService.isConnected()) {
      return;
    }

    try {
      await client.del(this.buildKey(key));
    } catch {
      this.logger.warn(`Cache del failed for ${key}`);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const client = this.redisService.getClient();
    if (!client || !this.redisService.isConnected()) {
      return;
    }

    const fullPattern = this.buildKey(pattern);
    const stream = client.scanStream({ match: fullPattern, count: 100 });
    for await (const keys of stream) {
      if (keys.length) {
        await client.del(...keys);
      }
    }
  }
}
