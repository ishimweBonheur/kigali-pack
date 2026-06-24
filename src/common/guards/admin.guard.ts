import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OrganizationRole } from '../../modules/organizations/entities/organization-member.entity';
import { JwtPayload } from '../../modules/organizations/organization.service';
import { extractBearerToken } from '../utils/bearer-token.util';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      member?: JwtPayload;
    }>();

    const adminApiKey = process.env.ADMIN_API_KEY;
    const providedAdminKey = request.headers['x-admin-key'];
    if (
      adminApiKey &&
      typeof providedAdminKey === 'string' &&
      providedAdminKey === adminApiKey
    ) {
      return true;
    }

    const authHeader = request.headers['authorization'];
    const token = extractBearerToken(
      typeof authHeader === 'string' ? authHeader : authHeader?.[0],
    );
    if (!token) {
      throw new UnauthorizedException('Admin authentication required');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      request.member = payload;

      if (
        payload.role !== OrganizationRole.MASTER_ADMIN &&
        payload.role !== OrganizationRole.ADMIN &&
        payload.role !== OrganizationRole.OWNER &&
        payload.role !== OrganizationRole.ORG_OWNER
      ) {
        throw new ForbiddenException('Admin role required');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid admin credentials');
    }
  }
}
