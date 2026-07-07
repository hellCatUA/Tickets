<script setup lang="ts">
import {
  AssetObjectSummaryDto,
  CategoryDto,
  FormValues,
  LocationDto,
  ObjectFamilyDto,
  ProblemDto,
  TICKET_PRIORITY_LABELS,
  TicketPriority,
} from '@tickets/shared';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DynamicForm from '../components/DynamicForm.vue';
import { AssetsApi, CategoriesApi, ProblemsApi, TicketsApi } from '../lib/api';

const router = useRouter();
const route = useRoute();

const categories = ref<CategoryDto[]>([]);
const locations = ref<LocationDto[]>([]);
const objects = ref<AssetObjectSummaryDto[]>([]);
const families = ref<ObjectFamilyDto[]>([]);
const problems = ref<ProblemDto[]>([]);

const categoryId = ref('');
const problemId = ref<string | null>(null);
const objectId = ref<string | null>(null);
/** "Other request" pressed — hide the quick-pick list, show the search. */
const quickDismissed = ref(false);
const locationId = ref<string | null>(null);
const title = ref('');
const description = ref('');
const priority = ref<TicketPriority>(TicketPriority.Normal);
const formValues = ref<FormValues>({});
const error = ref('');
const submitting = ref(false);

// ---- omni search ----
const query = ref('');
const searchOpen = ref(false);
const searchRef = ref<HTMLElement | null>(null);

const category = computed(() => categories.value.find((c) => c.id === categoryId.value) ?? null);
const problem = computed(() => problems.value.find((p) => p.id === problemId.value) ?? null);
const selectedObject = computed(
  () => objects.value.find((o) => o.id === objectId.value) ?? null,
);
const selectedFamilyId = computed(() => selectedObject.value?.familyId ?? null);
const familiesById = computed(() => new Map(families.value.map((f) => [f.id, f])));

/** Bidirectional link: explicit family checkboxes OR an active problem routed there. */
function categoryAppliesToFamily(c: CategoryDto, familyId: string): boolean {
  if (c.objectFamilies.length === 0) return true;
  if (c.objectFamilies.includes(familyId)) return true;
  return problems.value.some((p) => p.familyId === familyId && p.categoryId === c.id);
}

/** Categories applicable to the picked device (or all when none picked). */
const allowedCategories = computed(() =>
  categories.value.filter(
    (c) => !selectedFamilyId.value || categoryAppliesToFamily(c, selectedFamilyId.value),
  ),
);

/** Objects applicable to the picked problem/category and location. */
const allowedObjects = computed(() =>
  objects.value.filter(
    (o) =>
      (!locationId.value || o.locationId === locationId.value) &&
      (!problem.value || o.familyId === problem.value.familyId) &&
      (!category.value || categoryAppliesToFamily(category.value, o.familyId)),
  ),
);

/** Problems of the picked device's family — the quick-pick list. */
const familyProblems = computed(() =>
  selectedFamilyId.value
    ? problems.value.filter((p) => p.familyId === selectedFamilyId.value)
    : [],
);

const showQuickPick = computed(
  () =>
    !!selectedObject.value &&
    !problemId.value &&
    !categoryId.value &&
    familyProblems.value.length > 0 &&
    !quickDismissed.value,
);

function matches(haystack: Array<string | null | undefined>, q: string): boolean {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.some((h) => h && h.toLowerCase().includes(t)));
}

const deviceResults = computed(() => {
  if (objectId.value) return [];
  return allowedObjects.value
    .filter(
      (o) =>
        !query.value.trim() ||
        matches([o.name, o.serialNo, o.inventoryNo, o.familyName, o.locationName], query.value),
    )
    .slice(0, 6);
});

const problemResults = computed(() => {
  if (problemId.value || categoryId.value) return [];
  return problems.value
    .filter(
      (p) =>
        (!selectedFamilyId.value || p.familyId === selectedFamilyId.value) &&
        (!query.value.trim() || matches([p.name, p.description, p.familyName], query.value)),
    )
    .slice(0, 6);
});

const categoryResults = computed(() => {
  if (categoryId.value) return [];
  return allowedCategories.value
    .filter((c) => !query.value.trim() || matches([c.name, c.description], query.value))
    .slice(0, 6);
});

const showSearch = computed(
  () =>
    (!categoryId.value && !showQuickPick.value) ||
    (!objectId.value && allowedObjects.value.length > 0),
);

const placeholder = computed(() => {
  if (problem.value && !objectId.value) return `Which device? (${problem.value.familyName})`;
  if (!categoryId.value && !objectId.value) {
    return 'Describe the problem or type a device name / serial…';
  }
  if (!categoryId.value) return 'Now pick the problem type…';
  return category.value?.objectRequired
    ? 'This category needs a device — search by name or serial…'
    : 'Optionally attach a device…';
});

function pickObject(o: AssetObjectSummaryDto): void {
  objectId.value = o.id;
  quickDismissed.value = false;
  if (!locationId.value) locationId.value = o.locationId;
  // No quick-pick problems? Fall back to the family's default category.
  const hasProblems = problems.value.some((p) => p.familyId === o.familyId);
  if (!categoryId.value && !problemId.value && !hasProblems) {
    const def = familiesById.value.get(o.familyId)?.defaultCategoryId;
    if (def && allowedCategories.value.some((c) => c.id === def)) categoryId.value = def;
  }
  query.value = '';
  searchOpen.value = false;
}

function pickProblem(p: ProblemDto): void {
  problemId.value = p.id;
  categoryId.value = p.categoryId;
  if (!title.value.trim()) title.value = p.name;
  query.value = '';
  searchOpen.value = false;
}

function pickCategory(c: CategoryDto): void {
  categoryId.value = c.id;
  query.value = '';
  searchOpen.value = false;
}

function clearObject(): void {
  objectId.value = null;
  quickDismissed.value = false;
}

function clearProblem(): void {
  if (problem.value && categoryId.value === problem.value.categoryId) categoryId.value = '';
  if (title.value === problem.value?.name) title.value = '';
  problemId.value = null;
}

function clearCategory(): void {
  if (problemId.value) {
    clearProblem();
    return;
  }
  categoryId.value = '';
}

// A new device pick can invalidate the problem/category and vice versa.
watch(selectedFamilyId, (familyId) => {
  if (problemId.value && problem.value && familyId && problem.value.familyId !== familyId) {
    clearProblem();
  }
  if (categoryId.value && !allowedCategories.value.some((c) => c.id === categoryId.value)) {
    categoryId.value = '';
  }
});
watch(
  () => category.value?.id,
  (id) => {
    formValues.value = {};
    if (category.value) priority.value = category.value.defaultPriority;
    if (id && objectId.value && !allowedObjects.value.some((o) => o.id === objectId.value)) {
      objectId.value = null;
    }
  },
);

function onDocumentClick(event: MouseEvent): void {
  if (searchOpen.value && searchRef.value && !searchRef.value.contains(event.target as Node)) {
    searchOpen.value = false;
  }
}

onMounted(async () => {
  document.addEventListener('click', onDocumentClick);
  [categories.value, locations.value, objects.value, families.value, problems.value] =
    await Promise.all([
      CategoriesApi.list(),
      AssetsApi.locations().catch(() => []),
      AssetsApi.objects().catch(() => []),
      AssetsApi.families().catch(() => []),
      ProblemsApi.list().catch(() => []),
    ]);
  // QR flow: /tickets/new?object=<token> pre-selects the scanned device.
  const token = route.query.object;
  if (typeof token === 'string' && token) {
    try {
      const scanned = await AssetsApi.objectByToken(token);
      const object = objects.value.find((o) => o.id === scanned.id);
      if (object) pickObject(object);
    } catch {
      // unknown/stale token — start with a blank search
    }
  }
});

onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));

async function submit(): Promise<void> {
  error.value = '';
  if (!categoryId.value) {
    error.value = 'Please choose a problem type';
    return;
  }
  if (category.value?.objectRequired && !objectId.value) {
    error.value = 'This category requires selecting an object/device';
    return;
  }
  if (problemId.value && !objectId.value) {
    error.value = 'Please pick the device this problem is about';
    return;
  }
  submitting.value = true;
  try {
    const ticket = await TicketsApi.create({
      categoryId: categoryId.value,
      title: title.value,
      description: description.value,
      priority: category.value?.allowRequesterPriority ? priority.value : undefined,
      formValues: formValues.value,
      locationId: locationId.value,
      objectId: objectId.value,
      problemId: problemId.value,
    });
    await router.push(`/tickets/${ticket.id}`);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <h2>New ticket</h2>
    <form class="card form" @submit.prevent="submit">
      <!-- Omni picker: one field for both the problem type and the device -->
      <div class="picker">
        <div v-if="selectedObject || category || problem" class="chips">
          <span v-if="selectedObject" class="chip device">
            {{ selectedObject.name }}
            <span class="chip-sub">
              {{ selectedObject.serialNo ? `SN ${selectedObject.serialNo}` : selectedObject.familyName
              }}{{ selectedObject.locationName ? ` · ${selectedObject.locationName}` : '' }}
            </span>
            <button class="chip-x" type="button" title="Remove device" @click="clearObject">✕</button>
          </span>
          <span v-if="problem" class="chip">
            {{ problem.name }}
            <span class="chip-sub">{{ problem.familyName }}</span>
            <button class="chip-x" type="button" title="Change problem" @click="clearProblem">
              ✕
            </button>
          </span>
          <span v-else-if="category" class="chip">
            {{ category.name }}
            <button class="chip-x" type="button" title="Change request type" @click="clearCategory">
              ✕
            </button>
          </span>
        </div>

        <!-- Device picked: its family's problem list is one tap away -->
        <div v-if="showQuickPick" class="quick-pick">
          <div class="qp-title">What's wrong with it?</div>
          <button
            v-for="p in familyProblems"
            :key="p.id"
            class="qp-item"
            type="button"
            @click="pickProblem(p)"
          >
            <span class="r-main">{{ p.name }}</span>
            <span v-if="p.description" class="r-sub">{{ p.description }}</span>
          </button>
          <button class="qp-item other" type="button" @click="quickDismissed = true">
            <span class="r-main">Something else…</span>
            <span class="r-sub">search another request type</span>
          </button>
        </div>

        <div v-if="showSearch" ref="searchRef" class="searchbox">
          <input
            v-model="query"
            type="text"
            class="omni"
            :placeholder="placeholder"
            @focus="searchOpen = true"
            @input="searchOpen = true"
          />
          <div v-if="searchOpen" class="results">
            <template v-if="problemResults.length > 0">
              <div class="group-title">Problems</div>
              <button
                v-for="p in problemResults"
                :key="p.id"
                class="result"
                type="button"
                @click="pickProblem(p)"
              >
                <span class="r-main">{{ p.name }}</span>
                <span class="r-sub">
                  {{ p.familyName }}{{ p.description ? ` · ${p.description}` : '' }}
                </span>
              </button>
            </template>
            <template v-if="categoryResults.length > 0">
              <div class="group-title">Request types</div>
              <button
                v-for="c in categoryResults"
                :key="c.id"
                class="result"
                type="button"
                @click="pickCategory(c)"
              >
                <span class="r-main">{{ c.name }}</span>
                <span v-if="c.description" class="r-sub">{{ c.description }}</span>
              </button>
            </template>
            <template v-if="deviceResults.length > 0">
              <div class="group-title">Devices</div>
              <button
                v-for="o in deviceResults"
                :key="o.id"
                class="result"
                type="button"
                @click="pickObject(o)"
              >
                <span class="r-main">{{ o.name }}</span>
                <span class="r-sub">
                  {{ o.serialNo ? `SN ${o.serialNo} · ` : '' }}{{ o.familyName
                  }}{{ o.locationName ? ` · ${o.locationName}` : '' }}
                </span>
              </button>
            </template>
            <p
              v-if="
                categoryResults.length === 0 &&
                deviceResults.length === 0 &&
                problemResults.length === 0
              "
              class="muted no-results"
            >
              No matches — try another word, a serial number, or a device name.
            </p>
          </div>
        </div>
        <p v-if="category?.objectRequired && !objectId" class="muted hint">
          This problem type applies to a specific device — find it above.
        </p>
        <p v-if="category?.description" class="muted hint">{{ category.description }}</p>
      </div>

      <template v-if="category">
        <div class="field">
          <label class="field-label">Title<span class="req">*</span></label>
          <input v-model="title" type="text" required maxlength="200" />
        </div>

        <div class="field">
          <label class="field-label">Description</label>
          <textarea v-model="description" rows="4" placeholder="Describe the issue or request…" />
        </div>

        <div v-if="category.allowRequesterPriority" class="field">
          <label class="field-label">Priority</label>
          <select v-model="priority">
            <option v-for="(label, value) in TICKET_PRIORITY_LABELS" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </div>

        <div v-if="locations.length > 0 && !selectedObject" class="field">
          <label class="field-label">Location (optional)</label>
          <select v-model="locationId">
            <option :value="null">—</option>
            <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </div>

        <DynamicForm
          v-if="category.formFields.length > 0"
          v-model="formValues"
          :fields="category.formFields"
        />
      </template>
      <p v-else class="muted start-hint">
        Start typing above — e.g. “printer”, a serial number, or “access request”.
      </p>

      <p v-if="error" class="error-text">{{ error }}</p>

      <div class="actions">
        <button class="btn btn-primary" type="submit" :disabled="submitting || !category">
          {{ submitting ? 'Creating…' : 'Create ticket' }}
        </button>
        <router-link class="btn" to="/tickets">Cancel</router-link>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page {
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page h2 {
  margin: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.picker {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.4rem 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(47, 111, 237, 0.12);
  border: 1px solid rgba(47, 111, 237, 0.35);
  color: var(--accent);
  font-weight: 600;
  font-size: 0.92rem;
}

.chip.device {
  background: var(--surface-2);
  border-color: var(--border);
  color: var(--text);
}

.chip-sub {
  font-weight: 400;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.chip-x {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.1rem 0.3rem;
  border-radius: 50%;
}

.chip-x:hover {
  color: var(--danger);
}

.searchbox {
  position: relative;
}

.quick-pick {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  padding: 0.5rem;
}

.qp-title {
  padding: 0.15rem 0.5rem 0.35rem;
  font-weight: 600;
  font-size: 0.92rem;
}

.qp-item {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 4px);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.qp-item:hover {
  border-color: var(--accent);
}

.qp-item.other {
  background: transparent;
  border-style: dashed;
}

.omni {
  padding: 0.65rem 0.85rem;
  font-size: 1rem;
}

.results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 340px;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 0.35rem;
}

.group-title {
  padding: 0.35rem 0.6rem 0.2rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.result {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: none;
  border-radius: calc(var(--radius) - 4px);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.result:hover {
  background: var(--surface-2);
}

.r-main {
  font-weight: 600;
}

.r-sub {
  font-size: 0.82rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-results {
  margin: 0;
  padding: 0.5rem 0.6rem;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
}

.start-hint {
  margin: 0;
}

.field-label {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.3rem;
}

.req {
  color: var(--danger);
  margin-left: 2px;
}

.actions {
  display: flex;
  gap: 0.6rem;
}
</style>
