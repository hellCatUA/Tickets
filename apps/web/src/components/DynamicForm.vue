<script setup lang="ts">
import { FormField, FormValues, isFieldVisible } from '@tickets/shared';
import { computed } from 'vue';

const props = defineProps<{ fields: FormField[]; modelValue: FormValues }>();
const emit = defineEmits<{ (e: 'update:modelValue', values: FormValues): void }>();

const visibleFields = computed(() => props.fields.filter((f) => isFieldVisible(f, props.modelValue)));

function set(key: string, value: unknown): void {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

function onNumber(key: string, raw: string): void {
  set(key, raw === '' ? undefined : Number(raw));
}

function toggleMulti(field: FormField, option: string, checked: boolean): void {
  const current = Array.isArray(props.modelValue[field.key])
    ? [...(props.modelValue[field.key] as string[])]
    : [];
  const next = checked ? [...current, option] : current.filter((o) => o !== option);
  set(field.key, next);
}
</script>

<template>
  <div class="dyn-form">
    <div v-for="field in visibleFields" :key="field.key" class="field">
      <label class="field-label">
        {{ field.label }}<span v-if="field.required" class="req">*</span>
      </label>

      <input
        v-if="field.type === 'text'"
        type="text"
        :placeholder="field.placeholder"
        :value="(modelValue[field.key] as string) ?? ''"
        @input="set(field.key, ($event.target as HTMLInputElement).value)"
      />

      <textarea
        v-else-if="field.type === 'textarea'"
        rows="3"
        :placeholder="field.placeholder"
        :value="(modelValue[field.key] as string) ?? ''"
        @input="set(field.key, ($event.target as HTMLTextAreaElement).value)"
      />

      <input
        v-else-if="field.type === 'number'"
        type="number"
        :value="(modelValue[field.key] as number) ?? ''"
        @input="onNumber(field.key, ($event.target as HTMLInputElement).value)"
      />

      <input
        v-else-if="field.type === 'date'"
        type="date"
        :value="(modelValue[field.key] as string) ?? ''"
        @input="set(field.key, ($event.target as HTMLInputElement).value)"
      />

      <select
        v-else-if="field.type === 'select'"
        :value="(modelValue[field.key] as string) ?? ''"
        @change="set(field.key, ($event.target as HTMLSelectElement).value || undefined)"
      >
        <option value="">—</option>
        <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <div v-else-if="field.type === 'multiselect'" class="multi">
        <label v-for="opt in field.options" :key="opt" class="check">
          <input
            type="checkbox"
            :checked="Array.isArray(modelValue[field.key]) && (modelValue[field.key] as string[]).includes(opt)"
            @change="toggleMulti(field, opt, ($event.target as HTMLInputElement).checked)"
          />
          {{ opt }}
        </label>
      </div>

      <label v-else-if="field.type === 'checkbox'" class="check">
        <input
          type="checkbox"
          :checked="modelValue[field.key] === true"
          @change="set(field.key, ($event.target as HTMLInputElement).checked)"
        />
        {{ field.placeholder || 'Yes' }}
      </label>

      <p v-if="field.helpText" class="muted help">{{ field.helpText }}</p>
    </div>
  </div>
</template>

<style scoped>
.dyn-form {
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

.multi {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.check input {
  width: auto;
}

.help {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
}
</style>
