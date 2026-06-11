import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiKeyEntity } from '../../auth/entities/api-key.entity';

@Entity('sandbox_mock_transactions')
export class MockTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ApiKeyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'api_key_id' })
  apiKey!: ApiKeyEntity;

  @Column({ name: 'phone_number', type: 'varchar', length: 15 })
  phoneNumber!: string;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ name: 'gateway', type: 'varchar', length: 20 })
  gateway!: string;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'PENDING' })
  status!: string;

  @Column({ name: 'failure_reason', type: 'varchar', length: 100, nullable: true })
  failureReason!: string | null;

  @Column({ name: 'webhook_url', type: 'varchar', length: 500 })
  webhookUrl!: string;

  @Column({ name: 'client_reference', type: 'varchar', length: 100 })
  @Index()
  clientReference!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
