import { FormValues, TicketPriority, TicketStatus } from '@tickets/shared';
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
import { Location } from './location.entity';
import { User } from './user.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Canonical number, e.g. T-2026-0042. */
  @Index({ unique: true })
  @Column()
  ticketNo: string;

  @Column()
  year: number;

  @Column()
  seq: number;

  @Index()
  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ type: 'uuid' })
  formSchemaId: string;

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Index()
  @Column({ type: 'varchar', default: TicketStatus.New })
  status: TicketStatus;

  @Column({ type: 'varchar', default: TicketPriority.Normal })
  priority: TicketPriority;

  @Index()
  @Column({ type: 'uuid' })
  requesterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requesterId' })
  requester: User;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  assigneeId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigneeId' })
  assignee: User | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  formValues: FormValues;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'locationId' })
  location: Location | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  objectId: string | null;

  @ManyToOne(() => AssetObject, { nullable: true })
  @JoinColumn({ name: 'objectId' })
  object: AssetObject | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;
}
