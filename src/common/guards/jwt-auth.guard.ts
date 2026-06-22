import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { OrganizationRole } from '../../modules/organizations/entities/organization-member.entity';
import { JwtPayload } from '../../modules/organizations/organization.service';

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

function roleMatches(memberRole: OrganizationRole, required: OrganizationRole): boolean {
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
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing JWT bearer token');
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      request.member = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired JWT token');
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

    const request = context.switchToHttp().getRequest<{ member?: JwtPayload }>();
    const member = request.member;

    if (!member || !requiredRoles.some((role) => roleMatches(member.role, role))) {
      throw new UnauthorizedException('Insufficient role permissions');
    }

    return true;
  }
}
