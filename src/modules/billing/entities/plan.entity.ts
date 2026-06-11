import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('billing_plans')
export class PlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'price_monthly_rwf',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  priceMonthlyRwf!: number;

  @Column({ name: 'rate_limit_per_hour', type: 'integer', nullable: true })
  rateLimitPerHour!: number | null;

  @Column({ name: 'features', type: 'jsonb', default: '[]' })
  features!: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
