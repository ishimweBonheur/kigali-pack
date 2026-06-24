import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { OrganizationRole } from '../../modules/organizations/entities/organization-member.entity';
import { JwtPayload } from '../../modules/organizations/organization.service';
import { extractBearerToken } from '../utils/bearer-token.util';

const ROLE_ALIASES: Partial<Record<OrganizationRole, OrganizationRole[]>> = {
  [OrganizationRole.OWNER]: [
    OrganizationRole.OWNER,
    OrganizationRole.ORG_OWNER,
  ],
  [OrganizationRole.ORG_OWNER]: [
    OrganizationRole.OWNER,
    OrganizationRole.ORG_OWNER,
  ],
  [OrganizationRole.ADMIN]: [OrganizationRole.ADMIN],
  [OrganizationRole.DEVELOPER]: [OrganizationRole.DEVELOPER],
  [OrganizationRole.VIEWER]: [
    OrganizationRole.VIEWER,
    OrganizationRole.ORG_MEMBER,
  ],
  [OrganizationRole.ORG_MEMBER]: [
    OrganizationRole.VIEWER,
    OrganizationRole.ORG_MEMBER,
  ],
};

function roleMatches(
  memberRole: OrganizationRole,
  required: OrganizationRole,
): boolean {
  const aliases = ROLE_ALIASES[required] ?? [required];
  return aliases.includes(memberRole);
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
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

    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers['authorization']);

    if (!token) {
      throw new UnauthorizedException(
        'Missing JWT bearer token. Paste only the accessToken value — not the full login JSON.',
      );
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      request.member = payload;
      return true;
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired JWT token. Paste only accessToken from POST /v1/auth/login or /v1/auth/register.',
      );
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ member?: JwtPayload }>();
    const member = request.member;

    if (!member) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!requiredRoles.some((role) => roleMatches(member.role, role))) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
