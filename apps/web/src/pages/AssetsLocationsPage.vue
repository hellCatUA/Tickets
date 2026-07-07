<script setup lang="ts">
import { LocationDto, Permission } from '@tickets/shared';
import { computed, onMounted, ref } from 'vue';
import { AssetsApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const canManage = computed(() =>
  (auth.me?.permissions ?? []).includes(Permission.ManageLocations),
);

const locations = ref<LocationDto[]>([]);
const name = ref('');
const parentId = ref<string | null>(null);
const editingId = ref<string | null>(null);
const error = ref('');

const ordered = computed(() => {
  const byParent = new Map<string | null, LocationDto[]>();
  for (const l of locations.value) {
    const list = byParent.get(l.parentId) ?? [];
    list.push(l);
    byParent.set(l.parentId, list);
  }
  const out: Array<{ location: LocationDto; depth: number }> = [];
  const walk = (pid: string | null, depth: number): void => {
    for (const l of byParent.get(pid) ?? []) {
      out.push({ location: l, depth });
      walk(l.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
});

async function reload(): Promise<void> {
  locations.value = await AssetsApi.locations(true);
}

onMounted(reload);

function edit(location: LocationDto): void {
  editingId.value = location.id;
  name.value = location.name;
  parentId.value = location.parentId;
}

function reset(): void {
  editingId.value = null;
  name.value = '';
  parentId.value = null;
}

async function save(): Promise<void> {
  error.value = '';
  try {
    await AssetsApi.saveLocation(editingId.value, { name: name.value, parentId: parentId.value });
    reset();
    await reload();
  } catch (err) {
    error.value = (err as Error).message;
  }
}

async function toggleActive(location: LocationDto): Promise<void> {
  await AssetsApi.saveLocation(location.id, { active: !location.active });
  await reload();
}
</script>

<template>
  <div class="page">
    <h2>Locations</h2>

    <div class="card list">
      <p v-if="locations.length === 0" class="muted">No locations yet.</p>
      <div
        v-for="row in ordered"
        :key="row.location.id"
        class="loc-row"
        :class="{ inactive: !row.location.active }"
        :style="{ paddingLeft: `${0.5 + row.depth * 1.2}rem` }"
      >
        <span>{{ row.location.name }}</span>
        <span class="spacer" />
        <template v-if="canManage">
          <button class="btn icon" type="button" @click="edit(row.location)">Edit</button>
          <button class="btn icon" type="button" @click="toggleActive(row.location)">
            {{ row.location.active ? 'Deactivate' : 'Activate' }}
          </button>
        </template>
      </div>
    </div>

    <form v-if="canManage" class="card form" @submit.prevent="save">
      <h3>{{ editingId ? 'Edit location' : 'New location' }}</h3>
      <div class="row">
        <div class="grow">
          <label class="mini">Name</label>
          <input v-model="name" type="text" required />
        </div>
        <div class="grow">
          <label class="mini">Parent</label>
          <select v-model="parentId">
            <option :value="null">— top level —</option>
            <option
              v-for="l in locations.filter((l) => l.id !== editingId)"
              :key="l.id"
              :value="l.id"
            >
              {{ l.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" type="submit">{{ editingId ? 'Save' : 'Create' }}</button>
        <button v-if="editingId" class="btn" type="button" @click="reset">Cancel</button>
      </div>
      <p v-if="error" class="error-text">{{ error }}</p>
    </form>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 620px;
}

.page h2,
h3 {
  margin: 0;
}

.list {
  padding: 0.5rem;
}

.loc-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  border-radius: calc(var(--radius) - 4px);
}

.loc-row:hover {
  background: var(--surface-2);
}

.loc-row.inactive span:first-child {
  color: var(--text-muted);
  text-decoration: line-through;
}

.spacer {
  flex: 1;
}

.icon {
  padding: 0.25rem 0.6rem;
  font-size: 0.82rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.grow {
  flex: 1;
  min-width: 160px;
}

.mini {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}

.actions {
  display: flex;
  gap: 0.6rem;
}
</style>
