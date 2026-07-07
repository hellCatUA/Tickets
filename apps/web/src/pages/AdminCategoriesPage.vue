<script setup lang="ts">
import {
  CategoryAdminDto,
  FormField,
  GroupDto,
  ObjectFamilyDto,
  PriorityRule,
  TICKET_PRIORITY_LABELS,
  TicketPriority,
} from '@tickets/shared';
import { computed, onMounted, ref } from 'vue';
import FormBuilder from '../components/FormBuilder.vue';
import { AdminApi, AssetsApi, CategoriesApi } from '../lib/api';

const categories = ref<CategoryAdminDto[]>([]);
const groups = ref<GroupDto[]>([]);
const objectFamiliesList = ref<ObjectFamilyDto[]>([]);
const selectedId = ref<string | null>(null);
const isNew = ref(false);
const error = ref('');
const notice = ref('');

// edit buffer
const name = ref('');
const description = ref('');
const parentId = ref<string | null>(null);
const agentGroups = ref<string[]>([]);
const defaultPriority = ref<TicketPriority>(TicketPriority.Normal);
const allowRequesterPriority = ref(false);
const priorityRules = ref<PriorityRule[]>([]);
const objectFamilies = ref<string[]>([]);
const objectRequired = ref(false);

function toggleFamily(id: string, checked: boolean): void {
  objectFamilies.value = checked
    ? [...objectFamilies.value, id]
    : objectFamilies.value.filter((f) => f !== id);
}
const active = ref(true);
const fields = ref<FormField[]>([]);

/** Fields with a key — candidates for priority rules. */
const ruleFields = computed(() => fields.value.filter((f) => f.key));

function addRule(): void {
  priorityRules.value.push({
    field: ruleFields.value[0]?.key ?? '',
    equals: '',
    priority: TicketPriority.High,
  });
}

function removeRule(index: number): void {
  priorityRules.value.splice(index, 1);
}

const selected = computed(() => categories.value.find((c) => c.id === selectedId.value) ?? null);

const ordered = computed(() => {
  const byParent = new Map<string | null, CategoryAdminDto[]>();
  for (const c of categories.value) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  const out: Array<{ category: CategoryAdminDto; depth: number }> = [];
  const walk = (pid: string | null, depth: number): void => {
    for (const c of byParent.get(pid) ?? []) {
      out.push({ category: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
});

function select(category: CategoryAdminDto | null): void {
  error.value = '';
  notice.value = '';
  isNew.value = category === null;
  selectedId.value = category?.id ?? null;
  name.value = category?.name ?? '';
  description.value = category?.description ?? '';
  parentId.value = category?.parentId ?? null;
  agentGroups.value = [...(category?.agentGroups ?? [])];
  defaultPriority.value = category?.defaultPriority ?? TicketPriority.Normal;
  allowRequesterPriority.value = category?.allowRequesterPriority ?? false;
  priorityRules.value = JSON.parse(JSON.stringify(category?.priorityRules ?? [])) as PriorityRule[];
  objectFamilies.value = [...(category?.objectFamilies ?? [])];
  objectRequired.value = category?.objectRequired ?? false;
  active.value = category?.active ?? true;
  fields.value = JSON.parse(JSON.stringify(category?.formFields ?? [])) as FormField[];
}

async function reload(keepId?: string): Promise<void> {
  categories.value = await CategoriesApi.adminList();
  if (keepId) {
    const cat = categories.value.find((c) => c.id === keepId) ?? null;
    select(cat);
  }
}

onMounted(async () => {
  const [cats, grps, fams] = await Promise.all([
    CategoriesApi.adminList(),
    AdminApi.groups(),
    AssetsApi.families().catch(() => []),
  ]);
  categories.value = cats;
  groups.value = grps;
  objectFamiliesList.value = fams;
});

function toggleGroup(gid: string, checked: boolean): void {
  agentGroups.value = checked
    ? [...agentGroups.value, gid]
    : agentGroups.value.filter((g) => g !== gid);
}

async function saveCategory(): Promise<void> {
  error.value = '';
  notice.value = '';
  try {
    const payload = {
      name: name.value,
      description: description.value,
      parentId: parentId.value,
      agentGroups: agentGroups.value,
      defaultPriority: defaultPriority.value,
      allowRequesterPriority: allowRequesterPriority.value,
      priorityRules: priorityRules.value,
      objectFamilies: objectFamilies.value,
      objectRequired: objectRequired.value,
      active: active.value,
    };
    if (isNew.value) {
      const created = await CategoriesApi.create(payload);
      await reload(created.id);
      notice.value = 'Category created.';
    } else if (selectedId.value) {
      await CategoriesApi.update(selectedId.value, payload);
      await reload(selectedId.value);
      notice.value = 'Category saved.';
    }
  } catch (err) {
    error.value = (err as Error).message;
  }
}

async function saveForm(): Promise<void> {
  if (!selectedId.value) return;
  error.value = '';
  notice.value = '';
  try {
    await CategoriesApi.updateForm(selectedId.value, fields.value);
    await reload(selectedId.value);
    notice.value = `Form published (version ${selected.value?.formVersion}).`;
  } catch (err) {
    error.value = (err as Error).message;
  }
}
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <h2>Categories</h2>
      <button class="btn btn-primary" type="button" @click="select(null)">+ New category</button>
    </div>

    <div class="layout">
      <div class="card list">
        <p v-if="categories.length === 0" class="muted">
          No categories yet — create the first one.
        </p>
        <button
          v-for="row in ordered"
          :key="row.category.id"
          class="cat-row"
          :class="{ selected: row.category.id === selectedId, inactive: !row.category.active }"
          type="button"
          :style="{ paddingLeft: `${0.75 + row.depth * 1.1}rem` }"
          @click="select(row.category)"
        >
          {{ row.category.name }}
          <span v-if="!row.category.active" class="badge">inactive</span>
        </button>
      </div>

      <div v-if="isNew || selected" class="editor">
        <div class="card form">
          <h3>{{ isNew ? 'New category' : `Edit: ${selected?.name}` }}</h3>
          <div class="grid">
            <div>
              <label class="mini">Name</label>
              <input v-model="name" type="text" />
            </div>
            <div>
              <label class="mini">Parent</label>
              <select v-model="parentId">
                <option :value="null">— top level —</option>
                <option
                  v-for="c in categories.filter((c) => c.id !== selectedId)"
                  :key="c.id"
                  :value="c.id"
                >
                  {{ c.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="mini">Default priority</label>
              <select v-model="defaultPriority">
                <option v-for="(l, value) in TICKET_PRIORITY_LABELS" :key="value" :value="value">
                  {{ l }}
                </option>
              </select>
            </div>
            <label class="check">
              <input v-model="active" type="checkbox" />
              Active (visible for new tickets)
            </label>
          </div>
          <div>
            <label class="mini">Description</label>
            <textarea v-model="description" rows="2" />
          </div>
          <div>
            <label class="mini">Agent groups (who works these tickets)</label>
            <div class="groups">
              <label v-for="g in groups" :key="g.ncGid" class="check">
                <input
                  type="checkbox"
                  :checked="agentGroups.includes(g.ncGid)"
                  @change="toggleGroup(g.ncGid, ($event.target as HTMLInputElement).checked)"
                />
                {{ g.displayName }}
              </label>
            </div>
          </div>

          <div v-if="objectFamiliesList.length > 0" class="priority-block">
            <div>
              <label class="mini">
                Applies to device families (empty = any device or none)
              </label>
              <div class="groups">
                <label v-for="f in objectFamiliesList" :key="f.id" class="check">
                  <input
                    type="checkbox"
                    :checked="objectFamilies.includes(f.id)"
                    @change="toggleFamily(f.id, ($event.target as HTMLInputElement).checked)"
                  />
                  {{ f.name }}
                </label>
              </div>
            </div>
            <label class="check">
              <input v-model="objectRequired" type="checkbox" />
              Require an object/device on tickets in this category
            </label>
          </div>

          <div class="priority-block">
            <label class="check">
              <input v-model="allowRequesterPriority" type="checkbox" />
              Requester can choose the priority
            </label>
            <div>
              <label class="mini">
                Priority rules — first match wins and overrides any choice
              </label>
              <p v-if="priorityRules.length === 0" class="muted rules-hint">
                No rules. Tickets get the default priority
                {{ allowRequesterPriority ? 'unless the requester picks one' : '' }}.
              </p>
              <div v-for="(rule, i) in priorityRules" :key="i" class="rule">
                <span class="muted">if</span>
                <select v-model="rule.field">
                  <option v-for="f in ruleFields" :key="f.key" :value="f.key">
                    {{ f.label || f.key }}
                  </option>
                </select>
                <span class="muted">=</span>
                <input v-model="rule.equals" type="text" placeholder="value" />
                <span class="muted">→</span>
                <select v-model="rule.priority">
                  <option
                    v-for="(l, value) in TICKET_PRIORITY_LABELS"
                    :key="value"
                    :value="value"
                  >
                    {{ l }}
                  </option>
                </select>
                <button class="btn icon" type="button" title="Remove rule" @click="removeRule(i)">
                  ✕
                </button>
              </div>
              <button class="btn" type="button" :disabled="ruleFields.length === 0" @click="addRule">
                + Add rule
              </button>
              <p v-if="ruleFields.length === 0" class="muted rules-hint">
                Add form fields below first — rules react to their values.
              </p>
            </div>
          </div>

          <div class="actions">
            <button class="btn btn-primary" type="button" @click="saveCategory">
              {{ isNew ? 'Create category' : 'Save category' }}
            </button>
          </div>
        </div>

        <div v-if="!isNew && selected" class="card form">
          <h3>
            Request form
            <span class="muted version">v{{ selected.formVersion }}</span>
          </h3>
          <p class="muted hint">
            Changes are published as a new version; existing tickets keep the form they were
            created with.
          </p>
          <FormBuilder v-model="fields" />
          <div class="actions">
            <button class="btn btn-primary" type="button" @click="saveForm">Publish form</button>
          </div>
        </div>

        <p v-if="error" class="error-text">{{ error }}</p>
        <p v-if="notice" class="notice">{{ notice }}</p>
      </div>
      <div v-else class="card muted empty">Select a category or create a new one.</div>
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
  grid-template-columns: 260px 1fr;
  gap: 1rem;
  align-items: start;
}

.list {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cat-row {
  display: flex;
  align-items: center;
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

.cat-row:hover {
  background: var(--surface-2);
}

.cat-row.selected {
  background: var(--surface-2);
  color: var(--accent);
  font-weight: 600;
}

.cat-row.inactive {
  color: var(--text-muted);
}

.editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  gap: 0.75rem;
  align-items: end;
}

.mini {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.groups {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
}

.actions {
  display: flex;
  gap: 0.6rem;
}

.version {
  font-size: 0.85rem;
  font-weight: 400;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
}

.notice {
  color: #2ea05a;
  font-size: 0.9rem;
}

.priority-block {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border-top: 1px solid var(--border);
  padding-top: 0.75rem;
}

.rule {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  flex-wrap: wrap;
}

.rule select,
.rule input {
  width: auto;
  min-width: 120px;
  flex: 1;
}

.icon {
  padding: 0.35rem 0.55rem;
}

.rules-hint {
  margin: 0.2rem 0 0.4rem;
  font-size: 0.85rem;
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
