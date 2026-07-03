import { BadRequestException, Body, Controller, Get, Post, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GroupDto,
  Permission,
  PermissionGrantDto,
  Role,
  RoleMappingDto,
  SyncResultDto,
  UserSummaryDto,
} from '@tickets/shared';
import { Repository } from 'typeorm';
import { RequireRoles } from '../access/decorators';
import { PermissionGrant } from '../entities/permission-grant.entity';
import { RoleMapping } from '../entities/role-mapping.entity';
import { SyncService } from '../nextcloud/sync.service';
import { UsersService } from '../users/users.service';

@Controller('api/admin')
@RequireRoles(Role.Admin)
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly sync: SyncService,
    @InjectRepository(RoleMapping) private readonly mappings: Repository<RoleMapping>,
    @InjectRepository(PermissionGrant) private readonly grants: Repository<PermissionGrant>,
  ) {}

  @Get('groups')
  async listGroups(): Promise<GroupDto[]> {
    const groups = await this.users.listGroupsWithCounts();
    return groups.map((g) => ({
      id: g.id,
      ncGid: g.ncGid,
      displayName: g.displayName,
      memberCount: g.memberCount,
    }));
  }

  @Get('users')
  async listUsers(): Promise<UserSummaryDto[]> {
    const users = await this.users.listUsers();
    return users.map((u) => ({
      id: u.id,
      ncUid: u.ncUid,
      displayName: u.displayName,
      email: u.email,
      active: u.active,
    }));
  }

  @Get('role-mappings')
  async getRoleMappings(): Promise<RoleMappingDto[]> {
    const rows = await this.mappings.find({ order: { ncGid: 'ASC' } });
    return rows.map((r) => ({ ncGid: r.ncGid, role: r.role }));
  }

  /** Replaces the full mapping list (the admin UI edits it as a whole). */
  @Put('role-mappings')
  async putRoleMappings(@Body() body: RoleMappingDto[]): Promise<RoleMappingDto[]> {
    this.validate(body, Object.values(Role), 'role');
    await this.mappings.manager.transaction(async (em) => {
      await em.clear(RoleMapping);
      await em.save(
        body.map((m) => em.create(RoleMapping, { ncGid: m.ncGid, role: m.role })),
      );
    });
    return this.getRoleMappings();
  }

  @Get('permission-grants')
  async getPermissionGrants(): Promise<PermissionGrantDto[]> {
    const rows = await this.grants.find({ order: { ncGid: 'ASC' } });
    return rows.map((r) => ({ ncGid: r.ncGid, permission: r.permission }));
  }

  @Put('permission-grants')
  async putPermissionGrants(@Body() body: PermissionGrantDto[]): Promise<PermissionGrantDto[]> {
    this.validate(body, Object.values(Permission), 'permission');
    await this.grants.manager.transaction(async (em) => {
      await em.clear(PermissionGrant);
      await em.save(
        body.map((g) => em.create(PermissionGrant, { ncGid: g.ncGid, permission: g.permission })),
      );
    });
    return this.getPermissionGrants();
  }

  @Post('sync')
  runSync(): Promise<SyncResultDto> {
    return this.sync.run();
  }

  @Get('sync')
  lastSync(): SyncResultDto | null {
    return this.sync.lastResult;
  }

  private validate(body: Array<{ ncGid: string }>, allowed: string[], field: string): void {
    if (!Array.isArray(body)) throw new BadRequestException('Expected an array');
    for (const item of body) {
      if (!item?.ncGid || typeof item.ncGid !== 'string') {
        throw new BadRequestException('Each item needs a ncGid');
      }
      const value = (item as unknown as Record<string, unknown>)[field];
      if (!allowed.includes(value as string)) {
        throw new BadRequestException(`Invalid ${field}: ${String(value)}`);
      }
    }
  }
}
