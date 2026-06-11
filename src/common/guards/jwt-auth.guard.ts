import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { OrganizationRole } from '../../modules/organizations/entities/organization-member.entity';
import { JwtPayload } from '../../modules/organizations/organization.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (!member || !requiredRoles.includes(member.role)) {
      throw new UnauthorizedException('Insufficient role permissions');
    }

    return true;
  }
}
