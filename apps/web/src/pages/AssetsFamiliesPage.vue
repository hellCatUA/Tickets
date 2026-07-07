<script setup lang="ts">
import { FormField, ObjectFamilyDto, Permission } from '@tickets/shared';
import { computed, onMounted, ref } from 'vue';
import FormBuilder from '../components/FormBuilder.vue';
import { AssetsApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const canManage = computed(() => (auth.me?.permissions ?? []).includes(Permission.ManageObjects));

const families = ref<ObjectFamilyDto[]>([]);
const selectedId = ref<string | null>(null);
const isNew = ref(false);
const name = ref('');
const description = ref('');
const fields = ref<FormField[]>([]);
const error = ref('');
const notice = ref('');

function select(family: ObjectFamilyDto | null): void {
  isNew.value = family === null;
  selectedId.value = family?.id ?? null;
  name.value = family?.name ?? '';
  description.value = family?.description ?? '';
  fields.value = JSON.parse(JSON.stringify(family?.fields ?? [])) as FormField[];
  error.value = '';
  notice.value = '';
}

async function reload(keepId?: string): Promise<void> {
  families.value = await AssetsApi.families();
  if (keepId) select(families.value.find((f) => f.id === keepId) ?? null);
}

onMounted(() => reload());

async function save(): Promise<void> {
  error.value = '';
  try {
    const saved = await AssetsApi.saveFamily(isNew.value ? null : selectedId.value, {
      name: name.value,
      description: description.value,
      fields: fields.value,
    });
    await reload(saved.id);
    notice.value = 'Family saved.';
    setTimeout(() => (notice.value = ''), 4000);
  } catch (err) {
    error.value = (err as Error).message;
  }
}
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <h2>Device families</h2>
      <button v-if="canManage" class="btn btn-primary" type="button" @click="select(null)">
        + New family
      </button>
    </div>

    <div class="layout">
      <div class="card list">
        <p v-if="families.length === 0" class="muted">No families yet.</p>
        <button
          v-for="f in families"
          :key="f.id"
          class="fam-row"
          :class="{ selected: f.id === selectedId }"
          type="button"
          @click="select(f)"
        >
          {{ f.name }}
          <span class="muted count">{{ f.fields.length }} fields</span>
        </button>
      </div>

      <div v-if="isNew || selectedId" class="card form">
        <h3>{{ isNew ? 'New family' : `Edit: ${name}` }}</h3>
        <div>
          <label class="mini">Name</label>
          <input v-model="name" type="text" :disabled="!canManage" />
        </div>
        <div>
          <label class="mini">Description</label>
          <textarea v-model="description" rows="2" :disabled="!canManage" />
        </div>
        <div>
          <label class="mini">Custom fields (serial &amp; inventory numbers are built-in)</label>
          <FormBuilder v-if="canManage" v-model="fields" />
          <p v-else class="muted">{{ fields.map((f) => f.label).join(', ') || 'None' }}</p>
        </div>
        <div v-if="canManage" class="actions">
          <button class="btn btn-primary" type="button" @click="save">
            {{ isNew ? 'Create family' : 'Save family' }}
          </button>
        </div>
        <p v-if="error" class="error-text">{{ error }}</p>
        <p v-if="notice" class="notice">{{ notice }}</p>
      </div>
      <div v-else class="card muted empty">Select a family or create a new one.</div>
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

.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 1rem;
  align-items: start;
}

.list {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fam-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: calc(var(--radius) - 4px);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.fam-row:hover,
.fam-row.selected {
  background: var(--surface-2);
}

.fam-row.selected {
  color: var(--accent);
  font-weight: 600;
}

.count {
  font-size: 0.78rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form h3 {
  margin: 0;
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

.notice {
  color: #2ea05a;
  font-size: 0.9rem;
}

.empty {
  text-align: center;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
