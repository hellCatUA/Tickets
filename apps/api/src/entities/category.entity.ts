import { PriorityRule, TicketPriority } from '@tickets/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  /** Nextcloud group ids whose agents work tickets in this category. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  agentGroups: string[];

  @Column({ type: 'varchar', default: TicketPriority.Normal })
  defaultPriority: TicketPriority;

  /** Requesters may pick a priority only when explicitly enabled. */
  @Column({ default: false })
  allowRequesterPriority: boolean;

  /** Form-value driven priority rules; first match wins over any choice. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  priorityRules: PriorityRule[];

  /** Object-family ids this category applies to; empty = all. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  objectFamilies: string[];

  /** Tickets in this category must reference an object. */
  @Column({ default: false })
  objectRequired: boolean;

  @Column({ default: true })
  active: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  /** Current form schema version (see FormSchema). */
  @Column({ default: 1 })
  formVersion: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
