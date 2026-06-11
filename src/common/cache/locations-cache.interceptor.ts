import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from './cache.service';

const CACHE_KEY = 'locations:root-provinces';
const TTL_SECONDS = 600;

@Injectable()
export class LocationsCacheInterceptor implements NestInterceptor {
  constructor(private readonly cacheService: CacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const cached = await this.cacheService.get(CACHE_KEY);
    const response = context.switchToHttp().getResponse();

    if (cached !== null) {
      response.setHeader('X-Cache', 'HIT');
      return of(cached);
    }

    response.setHeader('X-Cache', 'MISS');
    return next.handle().pipe(
      tap(async (body) => {
        await this.cacheService.set(CACHE_KEY, body, TTL_SECONDS);
      }),
    );
  }
}
