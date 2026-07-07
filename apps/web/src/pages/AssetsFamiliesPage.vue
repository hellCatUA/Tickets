<script setup lang="ts">
import {
  CategoryDto,
  FormField,
  ObjectFamilyDto,
  Permission,
  ProblemDto,
  TICKET_PRIORITY_LABELS,
} from '@tickets/shared';
import { computed, onMounted, ref } from 'vue';
import FormBuilder from '../components/FormBuilder.vue';
import { AssetsApi, CategoriesApi, ProblemsApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const canManage = computed(() => (auth.me?.permissions ?? []).includes(Permission.ManageObjects));

const families = ref<ObjectFamilyDto[]>([]);
const categories = ref<CategoryDto[]>([]);
const selectedId = ref<string | null>(null);
const isNew = ref(false);
const name = ref('');
const description = ref('');
const defaultCategoryId = ref<string | null>(null);
const fields = ref<FormField[]>([]);
const problems = ref<Array<Partial<ProblemDto>>>([]);
const error = ref('');
const notice = ref('');

function addProblem(): void {
  problems.value.push({
    name: '',
    categoryId: categories.value[0]?.id ?? '',
    priority: null,
    active: true,
  });
}

async function loadProblems(familyId: string): Promise<void> {
  problems.value = await ProblemsApi.list(familyId, true).catch(() => []);
}

async function saveProblems(): Promise<void> {
  if (!selectedId.value) return;
  error.value = '';
  try {
    for (const p of problems.value) {
      if (!p.name?.trim()) continue;
      await ProblemsApi.save(p.id ?? null, {
        ...p,
        familyId: selectedId.value,
      });
    }
    await loadProblems(selectedId.value);
    flash('Problems saved.');
  } catch (err) {
    error.value = (err as Error).message;
  }
}

function flash(message: string): void {
  notice.value = message;
  setTimeout(() => (notice.value = ''), 4000);
}

function select(family: ObjectFamilyDto | null): void {
  isNew.value = family === null;
  selectedId.value = family?.id ?? null;
  name.value = family?.name ?? '';
  description.value = family?.description ?? '';
  defaultCategoryId.value = family?.defaultCategoryId ?? null;
  fields.value = JSON.parse(JSON.stringify(family?.fields ?? [])) as FormField[];
  problems.value = [];
  if (family) void loadProblems(family.id);
  error.value = '';
  notice.value = '';
}

async function reload(keepId?: string): Promise<void> {
  families.value = await AssetsApi.families();
  if (keepId) select(families.value.find((f) => f.id === keepId) ?? null);
}

onMounted(async () => {
  categories.value = await CategoriesApi.list().catch(() => []);
  await reload();
});

async function save(): Promise<void> {
  error.value = '';
  try {
    const saved = await AssetsApi.saveFamily(isNew.value ? null : selectedId.value, {
      name: name.value,
      description: description.value,
      fields: fields.value,
      defaultCategoryId: defaultCategoryId.value,
    });
    await reload(saved.id);
    flash('Family saved.');
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
          <label class="mini">Default ticket category (pre-selected on QR scans)</label>
          <select v-model="defaultCategoryId" :disabled="!canManage">
            <option :value="null">—</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
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

        <div v-if="!isNew" class="problems-block">
          <label class="mini">
            Problems — known symptoms/requests for this family; each routes into a category
          </label>
          <p v-if="problems.length === 0" class="muted small">
            No problems yet — devices of this family will fall back to plain category picking.
          </p>
          <div v-for="(p, i) in problems" :key="p.id ?? i" class="problem-row">
            <input
              v-model="p.name"
              type="text"
              placeholder="e.g. Paper jam"
              :disabled="!canManage"
            />
            <select v-model="p.categoryId" :disabled="!canManage">
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <select v-model="p.priority" :disabled="!canManage">
              <option :value="null">— category default —</option>
              <option v-for="(l, value) in TICKET_PRIORITY_LABELS" :key="value" :value="value">
                {{ l }}
              </option>
            </select>
            <label class="check">
              <input v-model="p.active" type="checkbox" :disabled="!canManage" />
              Active
            </label>
          </div>
          <div v-if="canManage" class="actions">
            <button class="btn" type="button" @click="addProblem">+ Add problem</button>
            <button class="btn btn-primary" type="button" @click="saveProblems">
              Save problems
            </button>
          </div>
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

.problems-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--border);
  padding-top: 0.75rem;
}

.problem-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr auto;
  gap: 0.5rem;
  align-items: center;
}

.small {
  margin: 0;
  font-size: 0.85rem;
}

@media (max-width: 800px) {
  .problem-row {
    grid-template-columns: 1fr;
  }
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
