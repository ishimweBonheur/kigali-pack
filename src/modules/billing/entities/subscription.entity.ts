import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { PlanEntity } from './plan.entity';
import { InvoiceEntity } from './invoice.entity';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  PAST_DUE = 'PAST_DUE',
}

@Entity('billing_subscriptions')
@Index(['developerName', 'status'])
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'developer_name', type: 'varchar', length: 255 })
  developerName!: string;

  @ManyToOne(() => PlanEntity)
  @JoinColumn({ name: 'plan_id' })
  plan!: PlanEntity;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 30,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column({ name: 'current_period_start', type: 'timestamptz' })
  currentPeriodStart!: Date;

  @Column({ name: 'current_period_end', type: 'timestamptz' })
  currentPeriodEnd!: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({
    name: 'momo_reference',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  momoReference!: string | null;

  @OneToMany(() => InvoiceEntity, (invoice) => invoice.subscription)
  invoices!: InvoiceEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
