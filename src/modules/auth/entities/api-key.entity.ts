import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('developer_api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'developer_name', type: 'varchar', length: 255 })
  developerName!: string;

  @Index({ unique: true })
  @Column({ name: 'hashed_key', type: 'varchar', length: 64 })
  hashedKey!: string;

  @Column({ name: 'tier', type: 'varchar', length: 50, default: 'FREE' })
  tier!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
