import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/** Append-only ticket timeline: the single source of truth for history and notifications. */
@Entity('ticket_events')
export class TicketEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  ticketId: string;

  /** created | status_changed | assigned | priority_changed | comment_added | attachment_added */
  @Column()
  type: string;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor: User | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
