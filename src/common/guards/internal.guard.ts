import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const internalKey = process.env.INTERNAL_API_KEY;
    if (!internalKey) {
      throw new UnauthorizedException('Internal API is not configured');
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    const provided =
      request.headers['x-internal-key'] ?? request.headers['x-service-key'];

    if (typeof provided !== 'string' || provided !== internalKey) {
      throw new UnauthorizedException('Valid internal service key required');
    }

    return true;
  }
}
