<script setup lang="ts">
import {
  AssetObjectSummaryDto,
  FormValues,
  LocationDto,
  ObjectFamilyDto,
  Permission,
} from '@tickets/shared';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DynamicForm from '../components/DynamicForm.vue';
import { AssetsApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const canManage = computed(() => (auth.me?.permissions ?? []).includes(Permission.ManageObjects));

const objects = ref<AssetObjectSummaryDto[]>([]);
const families = ref<ObjectFamilyDto[]>([]);
const locations = ref<LocationDto[]>([]);
const filterFamily = ref('');
const filterLocation = ref('');
const q = ref('');

const editing = ref(false);
const editingId = ref<string | null>(null);
const name = ref('');
const familyId = ref('');
const locationId = ref<string | null>(null);
const serialNo = ref('');
const inventoryNo = ref('');
const fieldValues = ref<FormValues>({});
const error = ref('');

const editFamily = computed(() => families.value.find((f) => f.id === familyId.value) ?? null);

async function reload(): Promise<void> {
  objects.value = await AssetsApi.objects({
    familyId: filterFamily.value || undefined,
    locationId: filterLocation.value || undefined,
    q: q.value || undefined,
    all: canManage.value,
  });
}

onMounted(async () => {
  [families.value, locations.value] = await Promise.all([
    AssetsApi.families(),
    AssetsApi.locations(),
  ]);
  await reload();
});

function startCreate(): void {
  editing.value = true;
  editingId.value = null;
  name.value = '';
  familyId.value = families.value[0]?.id ?? '';
  locationId.value = null;
  serialNo.value = '';
  inventoryNo.value = '';
  fieldValues.value = {};
  error.value = '';
}

async function startEdit(id: string): Promise<void> {
  const object = await AssetsApi.object(id);
  editing.value = true;
  editingId.value = id;
  name.value = object.name;
  familyId.value = object.familyId;
  locationId.value = object.locationId;
  serialNo.value = object.serialNo;
  inventoryNo.value = object.inventoryNo;
  fieldValues.value = { ...object.fields };
  error.value = '';
}

async function save(): Promise<void> {
  error.value = '';
  try {
    await AssetsApi.saveObject(editingId.value, {
      name: name.value,
      familyId: familyId.value,
      locationId: locationId.value,
      serialNo: serialNo.value,
      inventoryNo: inventoryNo.value,
      fields: fieldValues.value,
    });
    editing.value = false;
    await reload();
  } catch (err) {
    error.value = (err as Error).message;
  }
}
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <h2>Objects</h2>
      <button
        v-if="canManage"
        class="btn btn-primary"
        type="button"
        :disabled="families.length === 0"
        @click="startCreate"
      >
        + New object
      </button>
    </div>
    <p v-if="families.length === 0" class="muted">
      Create a <router-link to="/assets/families">device family</router-link> first.
    </p>

    <div class="filters">
      <select v-model="filterFamily" @change="reload">
        <option value="">All families</option>
        <option v-for="f in families" :key="f.id" :value="f.id">{{ f.name }}</option>
      </select>
      <select v-model="filterLocation" @change="reload">
        <option value="">All locations</option>
        <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
      </select>
      <form class="search" @submit.prevent="reload">
        <input v-model="q" type="search" placeholder="Name, serial or inventory no…" />
        <button class="btn" type="submit">Search</button>
      </form>
    </div>

    <div v-if="editing" class="card form">
      <h3>{{ editingId ? 'Edit object' : 'New object' }}</h3>
      <div class="grid">
        <div>
          <label class="mini">Name</label>
          <input v-model="name" type="text" />
        </div>
        <div>
          <label class="mini">Family</label>
          <select v-model="familyId">
            <option v-for="f in families" :key="f.id" :value="f.id">{{ f.name }}</option>
          </select>
        </div>
        <div>
          <label class="mini">Location</label>
          <select v-model="locationId">
            <option :value="null">—</option>
            <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </div>
        <div>
          <label class="mini">Serial number</label>
          <input v-model="serialNo" type="text" />
        </div>
        <div>
          <label class="mini">Inventory number</label>
          <input v-model="inventoryNo" type="text" />
        </div>
      </div>
      <DynamicForm
        v-if="editFamily && editFamily.fields.length > 0"
        v-model="fieldValues"
        :fields="editFamily.fields"
      />
      <div class="actions">
        <button class="btn btn-primary" type="button" @click="save">
          {{ editingId ? 'Save object' : 'Create object' }}
        </button>
        <button class="btn" type="button" @click="editing = false">Cancel</button>
      </div>
      <p v-if="error" class="error-text">{{ error }}</p>
    </div>

    <div class="rows card">
      <p v-if="objects.length === 0" class="muted empty">No objects found.</p>
      <div v-for="o in objects" :key="o.id" class="row" :class="{ inactive: !o.active }">
        <button class="link name" type="button" @click="router.push(`/assets/objects/${o.id}`)">
          {{ o.name }}
        </button>
        <span class="muted mono">{{ o.serialNo || '—' }}</span>
        <span class="muted">{{ o.familyName }}</span>
        <span class="muted">{{ o.locationName ?? '—' }}</span>
        <span class="spacer" />
        <button v-if="canManage" class="btn icon" type="button" @click="startEdit(o.id)">
          Edit
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar h2 {
  margin: 0;
}

.filters {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.filters select {
  width: auto;
  min-width: 150px;
}

.search {
  display: flex;
  gap: 0.4rem;
  flex: 1;
  min-width: 200px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form h3 {
  margin: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.6rem;
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

.rows {
  padding: 0.25rem 0.75rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.25rem;
  border-bottom: 1px solid var(--border);
}

.row:last-child {
  border-bottom: none;
}

.row.inactive {
  opacity: 0.55;
}

.link {
  border: none;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

.spacer {
  flex: 1;
}

.icon {
  padding: 0.25rem 0.6rem;
  font-size: 0.82rem;
}

.empty {
  padding: 0.5rem;
}
</style>
