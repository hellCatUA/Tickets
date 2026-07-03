import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Group } from '../entities/group.entity';
import { User } from '../entities/user.entity';

export interface LoginProfile {
  ncUid: string;
  displayName: string;
  email: string | null;
  groups: string[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
  ) {}

  /** Create/update the user (and their group memberships) from fresh OIDC claims. */
  async upsertFromLogin(profile: LoginProfile): Promise<User> {
    let user = await this.users.findOne({
      where: { ncUid: profile.ncUid },
      relations: { groups: true },
    });
    if (!user) {
      user = this.users.create({ ncUid: profile.ncUid, groups: [] });
    }
    user.displayName = profile.displayName;
    user.email = profile.email;
    user.active = true;
    user.lastLoginAt = new Date();
    user.groups = await this.ensureGroups(profile.groups);
    return this.users.save(user);
  }

  /** Upsert groups by Nextcloud gid and return the entities. */
  async ensureGroups(ncGids: string[], displayNames?: Map<string, string>): Promise<Group[]> {
    if (ncGids.length === 0) return [];
    const existing = await this.groups.find({ where: { ncGid: In(ncGids) } });
    const byGid = new Map(existing.map((g) => [g.ncGid, g]));
    const result: Group[] = [];
    for (const gid of ncGids) {
      let group = byGid.get(gid);
      const displayName = displayNames?.get(gid) ?? gid;
      if (!group) {
        group = await this.groups.save(this.groups.create({ ncGid: gid, displayName }));
      } else if (displayNames && group.displayName !== displayName) {
        group.displayName = displayName;
        group = await this.groups.save(group);
      }
      result.push(group);
    }
    return result;
  }

  async listUsers(): Promise<User[]> {
    return this.users.find({ order: { displayName: 'ASC' } });
  }

  async listGroupsWithCounts(): Promise<Array<Group & { memberCount: number }>> {
    const groups = await this.groups.find({ relations: { users: true }, order: { ncGid: 'ASC' } });
    return groups.map((g) => Object.assign(g, { memberCount: g.users.length }));
  }
}
