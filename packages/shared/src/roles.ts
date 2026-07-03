/** Base platform roles, resolved from Nextcloud group membership. */
export enum Role {
  Requester = 'requester',
  Agent = 'agent',
  Manager = 'manager',
  Admin = 'admin',
}

/** Fine-grained permissions grantable to Nextcloud groups independently of roles. */
export enum Permission {
  ManageLocations = 'manage:locations',
  ManageObjects = 'manage:objects',
  ManageVendors = 'manage:vendors',
  ManageBilling = 'manage:billing',
  ApproveBilling = 'approve:billing',
  ViewReports = 'view:reports',
  ManageAutomation = 'manage:automation',
}

/** Roles implied by a higher role (Admin ⊇ Manager ⊇ Agent ⊇ Requester). */
export const ROLE_HIERARCHY: Record<Role, Role[]> = {
  [Role.Admin]: [Role.Admin, Role.Manager, Role.Agent, Role.Requester],
  [Role.Manager]: [Role.Manager, Role.Agent, Role.Requester],
  [Role.Agent]: [Role.Agent, Role.Requester],
  [Role.Requester]: [Role.Requester],
};

export function expandRoles(roles: Role[]): Set<Role> {
  const out = new Set<Role>();
  for (const role of roles) {
    for (const implied of ROLE_HIERARCHY[role] ?? []) out.add(implied);
  }
  return out;
}
