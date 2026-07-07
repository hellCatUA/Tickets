import type { FormField } from '@tickets/shared';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Device category (Printers, Network, HVAC …) with its own custom field set. */
@Entity('object_families')
export class ObjectFamily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  fields: FormField[];

  @CreateDateColumn()
  createdAt: Date;
}
