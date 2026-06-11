import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

export type AdministrativeUnitLevel =
  | 'PROVINCE'
  | 'DISTRICT'
  | 'SECTOR'
  | 'CELL'
  | 'VILLAGE';

export const ADMINISTRATIVE_UNIT_LEVELS: readonly AdministrativeUnitLevel[] = [
  'PROVINCE',
  'DISTRICT',
  'SECTOR',
  'CELL',
  'VILLAGE',
] as const;

@Entity('administrative_units')
@Index(['level', 'isActive'])
export class AdministrativeUnitEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  @Index()
  name!: string;

  @Column({
    name: 'level',
    type: 'enum',
    enum: ADMINISTRATIVE_UNIT_LEVELS,
  })
  level!: AdministrativeUnitLevel;

  @Column({ name: 'code', type: 'varchar', length: 50, nullable: true })
  @Index({ unique: true, where: 'code IS NOT NULL' })
  code!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => AdministrativeUnitEntity, (unit) => unit.children, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent!: AdministrativeUnitEntity | null;

  @OneToMany(() => AdministrativeUnitEntity, (unit) => unit.parent)
  children!: AdministrativeUnitEntity[];
}
