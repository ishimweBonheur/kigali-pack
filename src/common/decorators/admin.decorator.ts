import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../modules/organizations/organization.service';

/**
 * Extracts the authenticated admin JWT payload from the request.
 * Must be used after AdminGuard or JwtAuthGuard.
 */
export const Admin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{
      member?: JwtPayload;
    }>();
    return request.member!;
  },
);
