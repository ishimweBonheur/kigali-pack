import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrganizationMemberEntity } from '../../organizations/entities/organization-member.entity';

export enum AuthActionTokenType {
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
}

@Entity('auth_action_tokens')
@Index(['tokenHash', 'type'])
export class AuthActionTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => OrganizationMemberEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member!: OrganizationMemberEntity;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ name: 'type', type: 'varchar', length: 30 })
  type!: AuthActionTokenType;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
