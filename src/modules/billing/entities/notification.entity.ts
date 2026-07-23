import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  PAYMENT_SUBMITTED = 'PAYMENT_SUBMITTED',
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  SUBSCRIPTION_ACTIVATED = 'SUBSCRIPTION_ACTIVATED',
  SUBSCRIPTION_EXPIRING = 'SUBSCRIPTION_EXPIRING',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  PLAN_CHANGED = 'PLAN_CHANGED',
  ADMIN_ACTION = 'ADMIN_ACTION',
}

@Entity('notifications')
@Index(['userId', 'read'])
@Index(['userId', 'createdAt'])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'user_email', type: 'varchar', length: 255, nullable: true })
  userEmail!: string | null;

  @Column({
    name: 'type',
    type: 'varchar',
    length: 50,
  })
  type!: NotificationType;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'message', type: 'text' })
  message!: string;

  @Column({ name: 'data', type: 'jsonb', nullable: true })
  data!: Record<string, unknown> | null;

  @Column({ name: 'read', type: 'boolean', default: false })
  read!: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
