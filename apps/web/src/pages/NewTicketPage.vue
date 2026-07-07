<script setup lang="ts">
import {
  AssetObjectSummaryDto,
  CategoryDto,
  FormValues,
  LocationDto,
  ObjectByTokenDto,
  TICKET_PRIORITY_LABELS,
  TicketPriority,
} from '@tickets/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DynamicForm from '../components/DynamicForm.vue';
import { AssetsApi, CategoriesApi, TicketsApi } from '../lib/api';

const router = useRouter();
const route = useRoute();

const categories = ref<CategoryDto[]>([]);
const locations = ref<LocationDto[]>([]);
const objects = ref<AssetObjectSummaryDto[]>([]);
const locationId = ref<string | null>(null);
const objectId = ref<string | null>(null);
const scannedObject = ref<ObjectByTokenDto | null>(null);

/** Objects narrowed to the picked location (all when none picked). */
const objectOptions = computed(() =>
  locationId.value ? objects.value.filter((o) => o.locationId === locationId.value) : objects.value,
);
const categoryId = ref('');
const title = ref('');
const description = ref('');
const priority = ref<TicketPriority>(TicketPriority.Normal);
const formValues = ref<FormValues>({});
const error = ref('');
const submitting = ref(false);

const category = computed(() => categories.value.find((c) => c.id === categoryId.value) ?? null);

/** Flatten the category tree into indented options. */
const options = computed(() => {
  const byParent = new Map<string | null, CategoryDto[]>();
  for (const c of categories.value) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  const out: Array<{ id: string; label: string }> = [];
  const walk = (parentId: string | null, depth: number): void => {
    for (const c of byParent.get(parentId) ?? []) {
      out.push({ id: c.id, label: `${'   '.repeat(depth)}${c.name}` });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
});

watch(category, (c) => {
  formValues.value = {};
  if (c) priority.value = c.defaultPriority;
});

onMounted(async () => {
  [categories.value, locations.value, objects.value] = await Promise.all([
    CategoriesApi.list(),
    AssetsApi.locations().catch(() => []),
    AssetsApi.objects().catch(() => []),
  ]);
  // QR flow: /tickets/new?object=<token> pre-selects the scanned device.
  const token = route.query.object;
  if (typeof token === 'string' && token) {
    try {
      scannedObject.value = await AssetsApi.objectByToken(token);
      objectId.value = scannedObject.value.id;
      locationId.value = scannedObject.value.locationId;
    } catch {
      scannedObject.value = null;
    }
  }
});

async function submit(): Promise<void> {
  error.value = '';
  if (!categoryId.value) {
    error.value = 'Please choose a category';
    return;
  }
  submitting.value = true;
  try {
    const ticket = await TicketsApi.create({
      categoryId: categoryId.value,
      title: title.value,
      description: description.value,
      // Sent only when the category allows requesters to choose; the server
      // enforces this and applies priority rules regardless.
      priority: category.value?.allowRequesterPriority ? priority.value : undefined,
      formValues: formValues.value,
      locationId: locationId.value,
      objectId: objectId.value,
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
    <div v-if="scannedObject" class="card scanned">
      Reporting an issue for <strong>{{ scannedObject.name }}</strong>
      <span class="muted">
        ({{ scannedObject.familyName }}, SN {{ scannedObject.serialNo || '—'
        }}{{ scannedObject.locationName ? `, ${scannedObject.locationName}` : '' }})
      </span>
    </div>
    <form class="card form" @submit.prevent="submit">
      <div class="field">
        <label class="field-label">Category<span class="req">*</span></label>
        <select v-model="categoryId" required>
          <option value="" disabled>Choose a category…</option>
          <option v-for="o in options" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
        <p v-if="category?.description" class="muted help">{{ category.description }}</p>
      </div>

      <div class="field">
        <label class="field-label">Title<span class="req">*</span></label>
        <input v-model="title" type="text" required maxlength="200" />
      </div>

      <div class="field">
        <label class="field-label">Description</label>
        <textarea v-model="description" rows="4" placeholder="Describe the issue or request…" />
      </div>

      <div v-if="category?.allowRequesterPriority" class="field">
        <label class="field-label">Priority</label>
        <select v-model="priority">
          <option v-for="(label, value) in TICKET_PRIORITY_LABELS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </div>

      <div v-if="locations.length > 0 || objects.length > 0" class="pair">
        <div v-if="locations.length > 0" class="grow">
          <label class="field-label">Location</label>
          <select v-model="locationId">
            <option :value="null">—</option>
            <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </div>
        <div v-if="objects.length > 0" class="grow">
          <label class="field-label">Object / device</label>
          <select v-model="objectId">
            <option :value="null">—</option>
            <option v-for="o in objectOptions" :key="o.id" :value="o.id">
              {{ o.name }}{{ o.serialNo ? ` (${o.serialNo})` : '' }}
            </option>
          </select>
        </div>
      </div>

      <DynamicForm
        v-if="category && category.formFields.length > 0"
        v-model="formValues"
        :fields="category.formFields"
      />

      <p v-if="error" class="error-text">{{ error }}</p>

      <div class="actions">
        <button class="btn btn-primary" type="submit" :disabled="submitting">
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

.help {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
}

.actions {
  display: flex;
  gap: 0.6rem;
}

.pair {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.grow {
  flex: 1;
  min-width: 180px;
}

.scanned {
  border-color: var(--accent);
}
</style>
