import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SubscriptionEntity } from './subscription.entity';

export enum PaymentRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum PaymentMethod {
  MTN_MOBILE_MONEY = 'MTN_MOBILE_MONEY',
  AIRTEL_MONEY = 'AIRTEL_MONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  OTHER = 'OTHER',
}

@Entity('payment_requests')
@Index(['userId', 'status'])
@Index(['status', 'createdAt'])
export class PaymentRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'user_email', type: 'varchar', length: 255 })
  userEmail!: string;

  @Column({ name: 'subscription_id', type: 'uuid', nullable: true })
  subscriptionId!: string | null;

  @ManyToOne(() => SubscriptionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subscription_id' })
  subscription!: SubscriptionEntity | null;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId!: string | null;

  @Column({ name: 'plan_name', type: 'varchar', length: 100, nullable: true })
  planName!: string | null;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  amount!: number;

  @Column({ name: 'currency', type: 'varchar', length: 10, default: 'RWF' })
  currency!: string;

  @Column({
    name: 'payment_method',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  paymentMethod!: string | null;

  @Column({
    name: 'transaction_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  transactionReference!: string | null;

  @Column({ name: 'payment_proof', type: 'text', nullable: true })
  paymentProof!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 30,
    default: PaymentRequestStatus.PENDING,
  })
  status!: PaymentRequestStatus;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes!: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({
    name: 'reviewed_by_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  reviewedByEmail!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
