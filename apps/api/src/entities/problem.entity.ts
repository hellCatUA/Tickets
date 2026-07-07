import { TicketPriority } from '@tickets/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { ObjectFamily } from './object-family.entity';

/**
 * A known symptom/request for a device family. Devices inherit their family's
 * problems; each problem routes into a category and may override the priority.
 */
@Entity('problems')
export class Problem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  familyId: string;

  @ManyToOne(() => ObjectFamily)
  @JoinColumn({ name: 'familyId' })
  family: ObjectFamily;

  @Column()
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ type: 'varchar', nullable: true })
  priority: TicketPriority | null;

  @Column({ default: true })
  active: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
