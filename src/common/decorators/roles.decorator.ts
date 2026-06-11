import { SetMetadata } from '@nestjs/common';
import { OrganizationRole } from '../../modules/organizations/entities/organization-member.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: OrganizationRole[]) =>
  SetMetadata(ROLES_KEY, roles);
