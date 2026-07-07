import { MaintenanceIntervalUnit, TicketPriority } from '@tickets/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssetObject } from './asset-object.entity';
import { Category } from './category.entity';
import { ObjectFamily } from './object-family.entity';
import { Problem } from './problem.entity';
import { User } from './user.entity';

/** Recurring maintenance: files tickets for a family (all devices) or one device. */
@Entity('maintenance_plans')
export class MaintenancePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'uuid', nullable: true })
  familyId: string | null;

  @ManyToOne(() => ObjectFamily, { nullable: true })
  @JoinColumn({ name: 'familyId' })
  family: ObjectFamily | null;

  @Column({ type: 'uuid', nullable: true })
  objectId: string | null;

  @ManyToOne(() => AssetObject, { nullable: true })
  @JoinColumn({ name: 'objectId' })
  object: AssetObject | null;

  @Column({ type: 'uuid', nullable: true })
  problemId: string | null;

  @ManyToOne(() => Problem, { nullable: true })
  @JoinColumn({ name: 'problemId' })
  problem: Problem | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category | null;

  @Column({ default: 'Maintenance: {name} ({serial})' })
  titleTemplate: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  priority: TicketPriority | null;

  @Column({ default: 30 })
  intervalValue: number;

  @Column({ type: 'varchar', default: 'days' })
  intervalUnit: MaintenanceIntervalUnit;

  @Index()
  @Column({ type: 'timestamptz' })
  nextDueAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  /** Maintenance tickets are filed on behalf of the plan's creator. */
  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
