import type { FormField } from '@tickets/shared';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Immutable snapshot of a category's form definition. Tickets reference the
 * schema they were created with, so later form edits never break old tickets.
 */
@Entity('form_schemas')
@Unique(['categoryId', 'version'])
export class FormSchema {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  categoryId: string;

  @Column()
  version: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  fields: FormField[];

  @CreateDateColumn()
  createdAt: Date;
}
