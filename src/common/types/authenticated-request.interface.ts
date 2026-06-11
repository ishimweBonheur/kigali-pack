import { ApiKeyEntity } from '../../modules/auth/entities/api-key.entity';

export interface AuthenticatedRequest {
  developer: ApiKeyEntity;
}
