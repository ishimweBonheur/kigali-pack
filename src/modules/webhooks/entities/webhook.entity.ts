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
import { ApiKeyEntity } from '../../auth/entities/api-key.entity';
import { WebhookDeliveryEntity } from './webhook-delivery.entity';

@Entity('webhooks')
export class WebhookEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ApiKeyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'api_key_id' })
  @Index()
  apiKey!: ApiKeyEntity;

  @Column({ name: 'url', type: 'varchar', length: 500 })
  url!: string;

  @Column({ name: 'secret', type: 'varchar', length: 128 })
  secret!: string;

  @Column({ name: 'events', type: 'text', array: true, default: '{}' })
  events!: string[];

  @Column({ name: 'description', type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => WebhookDeliveryEntity, (delivery) => delivery.webhook)
  deliveries!: WebhookDeliveryEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
