<script setup lang="ts">
import {
  GroupDto,
  Permission,
  PermissionGrantDto,
  Role,
  RoleMappingDto,
  SyncResultDto,
} from '@tickets/shared';
import { onMounted, ref } from 'vue';
import { AdminApi } from '../lib/api';

const groups = ref<GroupDto[]>([]);
const mappings = ref<RoleMappingDto[]>([]);
const grants = ref<PermissionGrantDto[]>([]);
const lastSync = ref<SyncResultDto | null>(null);
const syncing = ref(false);
const error = ref('');
const notice = ref('');

const ROLE_LABELS: Record<Role, string> = {
  [Role.Requester]: 'Requester',
  [Role.Agent]: 'Agent',
  [Role.Manager]: 'Manager',
  [Role.Admin]: 'Admin',
};

const PERMISSION_LABELS: Record<Permission, string> = {
  [Permission.ManageLocations]: 'Manage locations',
  [Permission.ManageObjects]: 'Manage objects',
  [Permission.ManageVendors]: 'Manage vendors',
  [Permission.ManageBilling]: 'Manage billing',
  [Permission.ApproveBilling]: 'Approve billing',
  [Permission.ViewReports]: 'View reports',
  [Permission.ManageAutomation]: 'Manage automation',
};

onMounted(async () => {
  const [g, m, p, s] = await Promise.all([
    AdminApi.groups(),
    AdminApi.roleMappings(),
    AdminApi.permissionGrants(),
    AdminApi.lastSync(),
  ]);
  groups.value = g;
  mappings.value = m;
  grants.value = p;
  lastSync.value = s;
});

function flash(message: string): void {
  notice.value = message;
  error.value = '';
  setTimeout(() => (notice.value = ''), 4000);
}

async function saveMappings(): Promise<void> {
  try {
    mappings.value = await AdminApi.saveRoleMappings(
      mappings.value.filter((m) => m.ncGid && m.role),
    );
    flash('Role mappings saved.');
  } catch (err) {
    error.value = (err as Error).message;
  }
}

async function saveGrants(): Promise<void> {
  try {
    grants.value = await AdminApi.savePermissionGrants(
      grants.value.filter((g) => g.ncGid && g.permission),
    );
    flash('Permissions saved.');
  } catch (err) {
    error.value = (err as Error).message;
  }
}

async function runSync(): Promise<void> {
  syncing.value = true;
  error.value = '';
  try {
    lastSync.value = await AdminApi.runSync();
    groups.value = await AdminApi.groups();
    flash('Directory synchronized.');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    syncing.value = false;
  }
}
</script>

<template>
  <div class="page">
    <h2>Access control</h2>
    <p class="muted intro">
      Roles are granted through Nextcloud groups. Members of the bootstrap admin group always
      have the Admin role, even without a mapping.
    </p>

    <div class="card section">
      <h3>Group → role mappings</h3>
      <div v-for="(m, i) in mappings" :key="i" class="row">
        <select v-model="m.ncGid">
          <option v-for="g in groups" :key="g.ncGid" :value="g.ncGid">{{ g.displayName }}</option>
        </select>
        <span class="muted">→</span>
        <select v-model="m.role">
          <option v-for="(label, value) in ROLE_LABELS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
        <button class="btn icon" type="button" @click="mappings.splice(i, 1)">✕</button>
      </div>
      <div class="actions">
        <button
          class="btn"
          type="button"
          @click="mappings.push({ ncGid: groups[0]?.ncGid ?? '', role: Role.Agent })"
        >
          + Add mapping
        </button>
        <button class="btn btn-primary" type="button" @click="saveMappings">Save mappings</button>
      </div>
    </div>

    <div class="card section">
      <h3>Group → extra permissions</h3>
      <p class="muted intro">
        Fine-grained rights independent of roles (locations, vendors, billing…). Admins hold all
        permissions implicitly.
      </p>
      <div v-for="(g, i) in grants" :key="i" class="row">
        <select v-model="g.ncGid">
          <option v-for="grp in groups" :key="grp.ncGid" :value="grp.ncGid">
            {{ grp.displayName }}
          </option>
        </select>
        <span class="muted">→</span>
        <select v-model="g.permission">
          <option v-for="(label, value) in PERMISSION_LABELS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
        <button class="btn icon" type="button" @click="grants.splice(i, 1)">✕</button>
      </div>
      <div class="actions">
        <button
          class="btn"
          type="button"
          @click="
            grants.push({ ncGid: groups[0]?.ncGid ?? '', permission: Permission.ViewReports })
          "
        >
          + Add permission
        </button>
        <button class="btn btn-primary" type="button" @click="saveGrants">Save permissions</button>
      </div>
    </div>

    <div class="card section">
      <h3>Nextcloud directory sync</h3>
      <p class="muted intro">
        <template v-if="lastSync">
          Last sync: {{ new Date(lastSync.finishedAt).toLocaleString() }} —
          {{ lastSync.users }} users, {{ lastSync.groups }} groups,
          {{ lastSync.deactivated }} deactivated.
        </template>
        <template v-else>No sync has run since the API started (cron runs it periodically).</template>
      </p>
      <div class="actions">
        <button class="btn btn-primary" type="button" :disabled="syncing" @click="runSync">
          {{ syncing ? 'Syncing…' : 'Sync now' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-if="notice" class="notice">{{ notice }}</p>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 760px;
}

.page h2 {
  margin: 0;
}

.intro {
  margin: 0;
  font-size: 0.9rem;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.section h3 {
  margin: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.row select {
  width: auto;
  flex: 1;
}

.icon {
  padding: 0.35rem 0.55rem;
}

.actions {
  display: flex;
  gap: 0.6rem;
}

.notice {
  color: #2ea05a;
  font-size: 0.9rem;
}
</style>
