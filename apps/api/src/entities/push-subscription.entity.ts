import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One Web Push subscription per browser/device. */
@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text', unique: true })
  endpoint: string;

  @Column()
  p256dh: string;

  @Column()
  auth: string;

  @CreateDateColumn()
  createdAt: Date;
}
