import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_ACTIVATED = 'SUBSCRIPTION_ACTIVATED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  PLAN_CREATED = 'PLAN_CREATED',
  PLAN_UPDATED = 'PLAN_UPDATED',
  PLAN_DISABLED = 'PLAN_DISABLED',
  PLAN_DELETED = 'PLAN_DELETED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_DELETED = 'USER_DELETED',
  INVOICE_CREATED = 'INVOICE_CREATED',
  INVOICE_STATUS_CHANGED = 'INVOICE_STATUS_CHANGED',
  API_LIMIT_OVERRIDDEN = 'API_LIMIT_OVERRIDDEN',
}

@Entity('audit_logs')
@Index(['action'])
@Index(['actorEmail'])
@Index(['targetEmail'])
@Index(['createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'action',
    type: 'varchar',
    length: 50,
  })
  action!: AuditAction;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ name: 'actor_email', type: 'varchar', length: 255, nullable: true })
  actorEmail!: string | null;

  @Column({ name: 'actor_role', type: 'varchar', length: 50, nullable: true })
  actorRole!: string | null;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId!: string | null;

  @Column({
    name: 'target_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  targetEmail!: string | null;

  @Column({ name: 'target_type', type: 'varchar', length: 50, nullable: true })
  targetType!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 50, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
