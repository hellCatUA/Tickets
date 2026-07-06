<script setup lang="ts">
import type { FieldType, FormField } from '@tickets/shared';
import { computed } from 'vue';

const props = defineProps<{ modelValue: FormField[] }>();
const emit = defineEmits<{ (e: 'update:modelValue', fields: FormField[]): void }>();

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Multiline text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
];

const fields = computed(() => props.modelValue);

function patch(index: number, changes: Partial<FormField>): void {
  const next = props.modelValue.map((f, i) => (i === index ? { ...f, ...changes } : f));
  emit('update:modelValue', next);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function onLabel(index: number, label: string): void {
  const field = props.modelValue[index];
  // Auto-derive the key from the label until the user edits the key manually.
  const autoKey = !field.key || field.key === slugify(field.label);
  patch(index, { label, ...(autoKey ? { key: slugify(label) } : {}) });
}

function setOptions(index: number, raw: string): void {
  patch(index, {
    options: raw
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean),
  });
}

function setShowIf(index: number, fieldKey: string, equals: string): void {
  patch(index, { showIf: fieldKey ? { field: fieldKey, equals } : null });
}

function add(): void {
  emit('update:modelValue', [
    ...props.modelValue,
    { key: '', label: '', type: 'text', required: false },
  ]);
}

function remove(index: number): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  );
}

function move(index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= props.modelValue.length) return;
  const next = [...props.modelValue];
  [next[index], next[target]] = [next[target], next[index]];
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="builder">
    <div v-for="(field, i) in fields" :key="i" class="field-card">
      <div class="row">
        <div class="grow">
          <label class="mini">Label</label>
          <input
            type="text"
            :value="field.label"
            @input="onLabel(i, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div>
          <label class="mini">Key</label>
          <input
            type="text"
            :value="field.key"
            @input="patch(i, { key: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div>
          <label class="mini">Type</label>
          <select
            :value="field.type"
            @change="patch(i, { type: ($event.target as HTMLSelectElement).value as FieldType })"
          >
            <option v-for="t in FIELD_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <label class="check req-check">
          <input
            type="checkbox"
            :checked="field.required === true"
            @change="patch(i, { required: ($event.target as HTMLInputElement).checked })"
          />
          Required
        </label>
        <div class="actions">
          <button class="btn icon" type="button" title="Move up" @click="move(i, -1)">↑</button>
          <button class="btn icon" type="button" title="Move down" @click="move(i, 1)">↓</button>
          <button class="btn icon" type="button" title="Remove" @click="remove(i)">✕</button>
        </div>
      </div>

      <div v-if="field.type === 'select' || field.type === 'multiselect'" class="row">
        <div class="grow">
          <label class="mini">Options (one per line)</label>
          <textarea
            rows="3"
            :value="(field.options ?? []).join('\n')"
            @input="setOptions(i, ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
      </div>

      <div class="row">
        <div class="grow">
          <label class="mini">Help text (optional)</label>
          <input
            type="text"
            :value="field.helpText ?? ''"
            @input="patch(i, { helpText: ($event.target as HTMLInputElement).value || undefined })"
          />
        </div>
        <div>
          <label class="mini">Show only when field…</label>
          <select
            :value="field.showIf?.field ?? ''"
            @change="setShowIf(i, ($event.target as HTMLSelectElement).value, String(field.showIf?.equals ?? ''))"
          >
            <option value="">Always visible</option>
            <option
              v-for="other in fields.filter((f) => f.key && f.key !== field.key)"
              :key="other.key"
              :value="other.key"
            >
              {{ other.label || other.key }}
            </option>
          </select>
        </div>
        <div v-if="field.showIf">
          <label class="mini">…equals</label>
          <input
            type="text"
            :value="String(field.showIf?.equals ?? '')"
            @input="setShowIf(i, field.showIf!.field, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>

    <button class="btn" type="button" @click="add">+ Add field</button>
  </div>
</template>

<style scoped>
.builder {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.75rem;
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.row {
  display: flex;
  gap: 0.6rem;
  align-items: flex-end;
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

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.check input {
  width: auto;
}

.req-check {
  padding-bottom: 0.5rem;
}

.actions {
  display: flex;
  gap: 0.25rem;
  padding-bottom: 0.15rem;
}

.icon {
  padding: 0.35rem 0.55rem;
}
</style>
