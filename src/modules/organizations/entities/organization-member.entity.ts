import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';

export enum OrganizationRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  DEVELOPER = 'DEVELOPER',
  VIEWER = 'VIEWER',
}

@Entity('organization_members')
@Unique(['organization', 'email'])
@Index(['email'])
export class OrganizationMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => OrganizationEntity, (org) => org.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: OrganizationEntity;

  @Column({ name: 'email', type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 128 })
  passwordHash!: string;

  @Column({
    name: 'role',
    type: 'varchar',
    length: 30,
    default: OrganizationRole.DEVELOPER,
  })
  role!: OrganizationRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
