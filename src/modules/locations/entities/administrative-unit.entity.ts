import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';

@Entity('administrative_units')
@Index(['level', 'isActive'])
export class AdministrativeUnitEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  @Index()
  name: string;

  @Column({
    name: 'level',
    type: 'enum',
    enum: ['PROVINCE', 'DISTRICT', 'SECTOR', 'CELL', 'VILLAGE'],
  })
  level: 'PROVINCE' | 'DISTRICT' | 'SECTOR' | 'CELL' | 'VILLAGE';

  @Column({ name: 'code', type: 'varchar', length: 50, nullable: true })
  @Index({ unique: true, where: "code IS NOT NULL" })
  code: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => AdministrativeUnitEntity, (unit) => unit.children, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: AdministrativeUnitEntity;

  @OneToMany(() => AdministrativeUnitEntity, (unit) => unit.parent)
  children: AdministrativeUnitEntity[];
}