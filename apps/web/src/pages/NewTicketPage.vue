<script setup lang="ts">
import {
  CategoryDto,
  FormValues,
  TICKET_PRIORITY_LABELS,
  TicketPriority,
} from '@tickets/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import DynamicForm from '../components/DynamicForm.vue';
import { CategoriesApi, TicketsApi } from '../lib/api';

const router = useRouter();

const categories = ref<CategoryDto[]>([]);
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
  categories.value = await CategoriesApi.list();
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
      priority: priority.value,
      formValues: formValues.value,
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

      <div class="field">
        <label class="field-label">Priority</label>
        <select v-model="priority">
          <option v-for="(label, value) in TICKET_PRIORITY_LABELS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
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
</style>
