import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ApiKeyEntity } from '../../auth/entities/api-key.entity';

@Entity('api_usage_daily')
@Unique(['apiKey', 'endpoint', 'usageDate'])
@Index(['apiKey', 'usageDate'])
export class ApiUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ApiKeyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'api_key_id' })
  apiKey!: ApiKeyEntity;

  @Column({ name: 'endpoint', type: 'varchar', length: 255 })
  @Index()
  endpoint!: string;

  @Column({ name: 'usage_date', type: 'date' })
  usageDate!: string;

  @Column({ name: 'requests', type: 'integer', default: 0 })
  requests!: number;

  @Column({
    name: 'average_latency_ms',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  averageLatencyMs!: number;

  @Column({ name: 'error_count', type: 'integer', default: 0 })
  errorCount!: number;
}
