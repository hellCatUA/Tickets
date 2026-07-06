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

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  ticketId: string;

  @Column({ type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'text' })
  body: string;

  /** Internal notes are visible to staff only, never to the requester. */
  @Column({ default: false })
  internal: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
