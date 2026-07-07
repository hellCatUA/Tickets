<script setup lang="ts">
import {
  AssetObjectSummaryDto,
  CategoryDto,
  MaintenanceIntervalUnit,
  MaintenancePlanDto,
  ObjectFamilyDto,
  ProblemDto,
  TICKET_PRIORITY_LABELS,
  TicketPriority,
} from '@tickets/shared';
import { computed, onMounted, ref } from 'vue';
import { AssetsApi, CategoriesApi, MaintenanceApi, ProblemsApi } from '../lib/api';

const plans = ref<MaintenancePlanDto[]>([]);
const families = ref<ObjectFamilyDto[]>([]);
const objects = ref<AssetObjectSummaryDto[]>([]);
const categories = ref<CategoryDto[]>([]);
const problems = ref<ProblemDto[]>([]);

const editing = ref(false);
const editingId = ref<string | null>(null);
const name = ref('');
const active = ref(true);
const targetType = ref<'family' | 'object'>('family');
const familyId = ref('');
const objectId = ref('');
const sourceType = ref<'problem' | 'category'>('problem');
const problemId = ref('');
const categoryId = ref('');
const titleTemplate = ref('Maintenance: {name} ({serial})');
const description = ref('');
const priority = ref<TicketPriority | null>(null);
const intervalValue = ref(30);
const intervalUnit = ref<MaintenanceIntervalUnit>('days');
const nextDueAt = ref('');
const error = ref('');
const notice = ref('');
const runResult = ref('');

const targetFamilyId = computed(() =>
  targetType.value === 'family'
    ? familyId.value
    : objects.value.find((o) => o.id === objectId.value)?.familyId ?? '',
);
const familyProblems = computed(() =>
  problems.value.filter((p) => p.familyId === targetFamilyId.value),
);

async function reload(): Promise<void> {
  plans.value = await MaintenanceApi.list();
}

onMounted(async () => {
  [families.value, objects.value, categories.value, problems.value] = await Promise.all([
    AssetsApi.families(),
    AssetsApi.objects(),
    CategoriesApi.list(),
    ProblemsApi.list(),
  ]);
  await reload();
});

function startCreate(): void {
  editing.value = true;
  editingId.value = null;
  name.value = '';
  active.value = true;
  targetType.value = 'family';
  familyId.value = families.value[0]?.id ?? '';
  objectId.value = '';
  sourceType.value = 'problem';
  problemId.value = '';
  categoryId.value = '';
  titleTemplate.value = 'Maintenance: {name} ({serial})';
  description.value = '';
  priority.value = null;
  intervalValue.value = 30;
  intervalUnit.value = 'days';
  nextDueAt.value = new Date().toISOString().slice(0, 16);
  error.value = '';
}

function startEdit(plan: MaintenancePlanDto): void {
  editing.value = true;
  editingId.value = plan.id;
  name.value = plan.name;
  active.value = plan.active;
  targetType.value = plan.objectId ? 'object' : 'family';
  familyId.value = plan.familyId ?? '';
  objectId.value = plan.objectId ?? '';
  sourceType.value = plan.problemId ? 'problem' : 'category';
  problemId.value = plan.problemId ?? '';
  categoryId.value = plan.categoryId ?? '';
  titleTemplate.value = plan.titleTemplate;
  description.value = plan.description;
  priority.value = plan.priority;
  intervalValue.value = plan.intervalValue;
  intervalUnit.value = plan.intervalUnit;
  nextDueAt.value = plan.nextDueAt.slice(0, 16);
  error.value = '';
}

async function save(): Promise<void> {
  error.value = '';
  try {
    await MaintenanceApi.save(editingId.value, {
      name: name.value,
      active: active.value,
      familyId: targetType.value === 'family' ? familyId.value : null,
      objectId: targetType.value === 'object' ? objectId.value : null,
      problemId: sourceType.value === 'problem' ? problemId.value || null : null,
      categoryId: sourceType.value === 'category' ? categoryId.value || null : null,
      titleTemplate: titleTemplate.value,
      description: description.value,
      priority: priority.value,
      intervalValue: intervalValue.value,
      intervalUnit: intervalUnit.value,
      nextDueAt: new Date(nextDueAt.value).toISOString(),
    });
    editing.value = false;
    await reload();
    flash('Plan saved.');
  } catch (err) {
    error.value = (err as Error).message;
  }
}

async function runNow(plan: MaintenancePlanDto): Promise<void> {
  error.value = '';
  try {
    const res = await MaintenanceApi.run(plan.id);
    runResult.value = `"${plan.name}": created ${res.created} ticket${res.created === 1 ? '' : 's'}.`;
    await reload();
  } catch (err) {
    error.value = (err as Error).message;
  }
}

function flash(message: string): void {
  notice.value = message;
  setTimeout(() => (notice.value = ''), 4000);
}

function describeTarget(p: MaintenancePlanDto): string {
  return p.objectId ? `Device: ${p.objectName}` : `Family: ${p.familyName} (all devices)`;
}
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <h2>Maintenance</h2>
      <button class="btn btn-primary" type="button" @click="startCreate">+ New plan</button>
    </div>
    <p class="muted intro">
      Plans file tickets automatically on their schedule (checked every 5 minutes). "Run now"
      also triggers a plan on demand — external systems can call the same endpoint.
    </p>

    <div v-if="editing" class="card form">
      <h3>{{ editingId ? 'Edit plan' : 'New plan' }}</h3>
      <div class="grid">
        <div>
          <label class="mini">Name</label>
          <input v-model="name" type="text" placeholder="Monthly printer service" />
        </div>
        <div>
          <label class="mini">Target</label>
          <select v-model="targetType">
            <option value="family">Whole family</option>
            <option value="object">Single device</option>
          </select>
        </div>
        <div v-if="targetType === 'family'">
          <label class="mini">Family</label>
          <select v-model="familyId">
            <option v-for="f in families" :key="f.id" :value="f.id">{{ f.name }}</option>
          </select>
        </div>
        <div v-else>
          <label class="mini">Device</label>
          <select v-model="objectId">
            <option v-for="o in objects" :key="o.id" :value="o.id">
              {{ o.name }}{{ o.serialNo ? ` (${o.serialNo})` : '' }}
            </option>
          </select>
        </div>
        <div>
          <label class="mini">File as</label>
          <select v-model="sourceType">
            <option value="problem">Family problem</option>
            <option value="category">Category</option>
          </select>
        </div>
        <div v-if="sourceType === 'problem'">
          <label class="mini">Problem</label>
          <select v-model="problemId">
            <option value="" disabled>Choose…</option>
            <option v-for="p in familyProblems" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div v-else>
          <label class="mini">Category</label>
          <select v-model="categoryId">
            <option value="" disabled>Choose…</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div>
          <label class="mini">Priority (optional)</label>
          <select v-model="priority">
            <option :value="null">— from problem/category —</option>
            <option v-for="(l, value) in TICKET_PRIORITY_LABELS" :key="value" :value="value">
              {{ l }}
            </option>
          </select>
        </div>
        <div>
          <label class="mini">Repeat every</label>
          <div class="interval">
            <input v-model.number="intervalValue" type="number" min="1" step="1" />
            <select v-model="intervalUnit">
              <option value="days">days</option>
              <option value="weeks">weeks</option>
              <option value="months">months</option>
            </select>
          </div>
        </div>
        <div>
          <label class="mini">Next run</label>
          <input v-model="nextDueAt" type="datetime-local" />
        </div>
        <label class="check">
          <input v-model="active" type="checkbox" />
          Active
        </label>
      </div>
      <div>
        <label class="mini">Ticket title template ({name}, {serial}, {family}, {date})</label>
        <input v-model="titleTemplate" type="text" />
      </div>
      <div>
        <label class="mini">Ticket description</label>
        <textarea v-model="description" rows="2" />
      </div>
      <div class="actions">
        <button class="btn btn-primary" type="button" @click="save">
          {{ editingId ? 'Save plan' : 'Create plan' }}
        </button>
        <button class="btn" type="button" @click="editing = false">Cancel</button>
      </div>
    </div>

    <div class="card list">
      <p v-if="plans.length === 0" class="muted empty">No maintenance plans yet.</p>
      <div v-for="p in plans" :key="p.id" class="plan-row" :class="{ inactive: !p.active }">
        <div class="plan-main">
          <strong>{{ p.name }}</strong>
          <span class="muted">
            {{ describeTarget(p) }} · {{ p.problemName ?? 'category' }} · every
            {{ p.intervalValue }} {{ p.intervalUnit }}
          </span>
          <span class="muted small">
            Next: {{ new Date(p.nextDueAt).toLocaleString() }}
            <template v-if="p.lastRunAt"> · Last: {{ new Date(p.lastRunAt).toLocaleString() }}</template>
            · by {{ p.createdBy?.displayName ?? '?' }}
          </span>
        </div>
        <button class="btn icon" type="button" @click="startEdit(p)">Edit</button>
        <button class="btn icon" type="button" @click="runNow(p)">Run now</button>
      </div>
    </div>

    <p v-if="runResult" class="notice">{{ runResult }}</p>
    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-if="notice" class="notice">{{ notice }}</p>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 860px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar h2 {
  margin: 0;
}

.intro {
  margin: 0;
  font-size: 0.9rem;
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
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.6rem;
  align-items: end;
}

.mini {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}

.interval {
  display: flex;
  gap: 0.4rem;
}

.interval input {
  width: 80px;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding-bottom: 0.4rem;
}

.actions {
  display: flex;
  gap: 0.6rem;
}

.list {
  padding: 0.5rem 0.75rem;
}

.plan-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.25rem;
  border-bottom: 1px solid var(--border);
}

.plan-row:last-child {
  border-bottom: none;
}

.plan-row.inactive {
  opacity: 0.55;
}

.plan-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.small {
  font-size: 0.8rem;
}

.icon {
  padding: 0.3rem 0.7rem;
  font-size: 0.85rem;
}

.empty {
  padding: 0.5rem;
}

.notice {
  color: #2ea05a;
  font-size: 0.9rem;
}
</style>
