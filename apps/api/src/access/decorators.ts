import { SetMetadata } from '@nestjs/common';
import type { Permission, Role } from '@tickets/shared';

export const IS_PUBLIC_KEY = 'isPublic';
/** Skip authentication for this route (login flow, health checks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'requiredRoles';
/** Require at least one of the given roles (authentication is always required). */
export const RequireRoles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'requiredPermissions';
/** Require at least one of the given permissions (Admins hold all implicitly). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
