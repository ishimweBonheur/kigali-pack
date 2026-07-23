import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyEntity } from './entities/api-key.entity';
import { AuthActionTokenEntity } from './entities/auth-action-token.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { ApiKeyService } from './api-key.service';
import { AuthService } from './auth.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { OrganizationMemberEntity } from '../organizations/entities/organization-member.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKeyEntity,
      OrganizationEntity,
      OrganizationMemberEntity,
      RefreshTokenEntity,
      AuthActionTokenEntity,
    ]),
  ],
  providers: [ApiKeyService, AuthService, ApiKeyGuard],
  exports: [ApiKeyService, AuthService, ApiKeyGuard],
})
export class AuthModule {}
