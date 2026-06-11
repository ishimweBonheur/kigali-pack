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

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PAID = 'PAID',
  VOID = 'VOID',
}

@Entity('billing_invoices')
@Index(['subscription'])
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SubscriptionEntity, (sub) => sub.invoices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subscription_id' })
  subscription!: SubscriptionEntity;

  @Column({ name: 'amount_rwf', type: 'decimal', precision: 12, scale: 2 })
  amountRwf!: number;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 30,
    default: InvoiceStatus.OPEN,
  })
  status!: InvoiceStatus;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
