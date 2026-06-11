import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiKeyEntity } from '../../auth/entities/api-key.entity';

@Entity('developer_api_logs')
export class ApiLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ApiKeyEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'api_key_id' })
  @Index()
  apiKey!: ApiKeyEntity;

  @Column({ name: 'endpoint', type: 'varchar', length: 255 })
  endpoint!: string;

  @Column({ name: 'method', type: 'varchar', length: 10 })
  method!: string;

  @Column({ name: 'status_code', type: 'integer' })
  statusCode!: number;

  @Column({ name: 'response_time_ms', type: 'integer' })
  responseTimeMs!: number;

  @CreateDateColumn({ name: 'timestamp', type: 'timestamptz' })
  @Index()
  timestamp!: Date;
}
