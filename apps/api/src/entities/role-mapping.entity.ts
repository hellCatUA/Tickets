import { Role } from '@tickets/shared';
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Maps a Nextcloud group to a platform role. Referenced by group id string
 * (not FK) so a mapping survives group deletion/re-creation in Nextcloud.
 */
@Entity('role_mappings')
@Unique(['ncGid', 'role'])
export class RoleMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ncGid: string;

  @Column({ type: 'varchar' })
  role: Role;
}
