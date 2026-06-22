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
  /** @deprecated Use ORG_OWNER */
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  DEVELOPER = 'DEVELOPER',
  /** @deprecated Use ORG_MEMBER */
  VIEWER = 'VIEWER',
  ORG_OWNER = 'ORG_OWNER',
  ORG_MEMBER = 'ORG_MEMBER',
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
