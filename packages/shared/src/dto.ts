import type { Permission, Role } from './roles';

/** Returned by GET /api/me */
export interface MeDto {
  id: string;
  ncUid: string;
  displayName: string;
  email: string | null;
  roles: Role[];
  permissions: Permission[];
  groups: string[];
}

export interface GroupDto {
  id: string;
  ncGid: string;
  displayName: string;
  memberCount: number;
}

export interface UserSummaryDto {
  id: string;
  ncUid: string;
  displayName: string;
  email: string | null;
  active: boolean;
}

export interface RoleMappingDto {
  ncGid: string;
  role: Role;
}

export interface PermissionGrantDto {
  ncGid: string;
  permission: Permission;
}

export interface SyncResultDto {
  users: number;
  groups: number;
  deactivated: number;
  startedAt: string;
  finishedAt: string;
}
