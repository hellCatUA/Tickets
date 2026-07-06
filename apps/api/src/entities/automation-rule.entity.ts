import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Configurable automation rule. `type` selects a built-in behaviour, `params`
 * carries its thresholds. One row per type.
 */
@Entity('automation_rules')
export class AutomationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** auto_close_resolved | escalate_unassigned */
  @Index({ unique: true })
  @Column()
  type: string;

  @Column({ default: false })
  enabled: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  params: Record<string, number>;

  @UpdateDateColumn()
  updatedAt: Date;
}
