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

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  ticketId: string;

  @Column({ type: 'uuid' })
  uploaderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaderId' })
  uploader: User;

  /** Original filename shown to users. */
  @Column()
  filename: string;

  /** Randomized name on the attachments volume. */
  @Column()
  storedName: string;

  @Column()
  mimeType: string;

  @Column()
  size: number;

  @CreateDateColumn()
  createdAt: Date;
}
