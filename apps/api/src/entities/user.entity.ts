import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nextcloud user id (OIDC `sub`). */
  @Index({ unique: true })
  @Column()
  ncUid: string;

  @Column()
  displayName: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  /** False when the user disappeared from Nextcloud or was disabled there. */
  @Column({ default: true })
  active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @ManyToMany(() => Group, (group) => group.users)
  @JoinTable({ name: 'user_groups' })
  groups: Group[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
