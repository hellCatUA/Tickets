import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Per-user notification channel preferences: prefs[channel][eventType] = enabled. */
@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  prefs: Record<string, Record<string, boolean>>;

  @UpdateDateColumn()
  updatedAt: Date;
}
