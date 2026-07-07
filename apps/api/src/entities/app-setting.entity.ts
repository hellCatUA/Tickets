import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Small key/value store for server-generated settings (e.g. VAPID keys). */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'text' })
  value: string;
}
