import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiKeyEnvironment, ApiKeyTier } from '../enums/api-key.enum';

@Entity('developer_api_keys')
@Index(['developerName', 'isActive'])
@Index(['hashedKey', 'isActive'])
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'developer_name', type: 'varchar', length: 255 })
  developerName!: string;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true })
  name!: string | null;

  @Index({ unique: true })
  @Column({ name: 'hashed_key', type: 'varchar', length: 64 })
  hashedKey!: string;

  @Column({ name: 'key_prefix', type: 'varchar', length: 20 })
  keyPrefix!: string;

  @Column({
    name: 'environment',
    type: 'varchar',
    length: 20,
    default: ApiKeyEnvironment.TEST,
  })
  environment!: ApiKeyEnvironment;

  @Column({
    name: 'tier',
    type: 'varchar',
    length: 50,
    default: ApiKeyTier.FREE,
  })
  tier!: ApiKeyTier;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
