import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { expandRoles, MeDto, Permission, Role } from '@tickets/shared';
import { In, Repository } from 'typeorm';
import { PermissionGrant } from '../entities/permission-grant.entity';
import { RoleMapping } from '../entities/role-mapping.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RoleMapping) private readonly mappings: Repository<RoleMapping>,
    @InjectRepository(PermissionGrant) private readonly grants: Repository<PermissionGrant>,
    private readonly config: ConfigService,
  ) {}

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.users.findOne({ where: { id: userId }, relations: { groups: true } });
    if (!user || !user.active) throw new NotFoundException('User not found or deactivated');

    const groupIds = user.groups.map((g) => g.ncGid);
    const directRoles: Role[] = [Role.Requester]; // any authenticated Nextcloud user may file tickets

    if (groupIds.length > 0) {
      const rows = await this.mappings.find({ where: { ncGid: In(groupIds) } });
      directRoles.push(...rows.map((r) => r.role));
    }

    // Bootstrap: members of this group are Admins even before any mapping exists.
    const bootstrapAdminGroup = this.config.get<string>('BOOTSTRAP_ADMIN_GROUP');
    if (bootstrapAdminGroup && groupIds.includes(bootstrapAdminGroup)) {
      directRoles.push(Role.Admin);
    }

    const roles = [...expandRoles(directRoles)];

    const permissions = new Set<Permission>();
    if (roles.includes(Role.Admin)) {
      for (const p of Object.values(Permission)) permissions.add(p);
    } else if (groupIds.length > 0) {
      const rows = await this.grants.find({ where: { ncGid: In(groupIds) } });
      for (const row of rows) permissions.add(row.permission);
    }

    return {
      id: user.id,
      ncUid: user.ncUid,
      displayName: user.displayName,
      email: user.email,
      roles,
      permissions: [...permissions],
      groups: groupIds,
    };
  }
}
