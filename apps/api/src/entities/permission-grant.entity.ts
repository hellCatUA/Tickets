import { Permission } from '@tickets/shared';
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Grants a fine-grained permission to a Nextcloud group. */
@Entity('permission_grants')
@Unique(['ncGid', 'permission'])
export class PermissionGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ncGid: string;

  @Column({ type: 'varchar' })
  permission: Permission;
}
