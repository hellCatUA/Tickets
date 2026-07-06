/** Dynamic form-builder field model shared by the API (validation) and the web UI (rendering). */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'checkbox';

export interface FormFieldCondition {
  /** Key of the controlling field. */
  field: string;
  equals: string | number | boolean;
}

export interface FormField {
  /** Stable machine key the value is stored under. */
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  /** Choices for select / multiselect. */
  options?: string[];
  /** Conditional visibility: show only when another field has a given value. */
  showIf?: FormFieldCondition | null;
}

export type FormValues = Record<string, unknown>;

export function isFieldVisible(field: FormField, values: FormValues): boolean {
  if (!field.showIf) return true;
  // Loose string comparison so "true" matches a checkbox boolean etc.
  return String(values[field.showIf.field]) === String(field.showIf.equals);
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Validates submitted values against a schema; returns human-readable errors (empty = valid). */
export function validateFormValues(fields: FormField[], values: FormValues): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    if (!isFieldVisible(field, values)) continue;
    const value = values[field.key];
    if (isEmpty(value)) {
      if (field.required) errors.push(`"${field.label}" is required`);
      continue;
    }
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'date':
        if (typeof value !== 'string') errors.push(`"${field.label}" must be a string`);
        break;
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push(`"${field.label}" must be a number`);
        }
        break;
      case 'checkbox':
        if (typeof value !== 'boolean') errors.push(`"${field.label}" must be a boolean`);
        break;
      case 'select':
        if (typeof value !== 'string' || !(field.options ?? []).includes(value)) {
          errors.push(`"${field.label}" has an invalid choice`);
        }
        break;
      case 'multiselect':
        if (
          !Array.isArray(value) ||
          value.some((v) => typeof v !== 'string' || !(field.options ?? []).includes(v))
        ) {
          errors.push(`"${field.label}" has an invalid choice`);
        }
        break;
    }
  }
  return errors;
}

/** Validates a form definition itself (admin form builder input). */
export function validateFormFields(fields: FormField[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const field of fields) {
    if (!field.key || !/^[a-z0-9_]+$/.test(field.key)) {
      errors.push(`Field key "${field.key}" must be lowercase letters, digits or underscores`);
    }
    if (seen.has(field.key)) errors.push(`Duplicate field key "${field.key}"`);
    seen.add(field.key);
    if (!field.label?.trim()) errors.push(`Field "${field.key}" needs a label`);
    if (
      (field.type === 'select' || field.type === 'multiselect') &&
      (field.options ?? []).length === 0
    ) {
      errors.push(`Field "${field.label}" needs at least one option`);
    }
    if (field.showIf && !fields.some((f) => f.key === field.showIf!.field)) {
      errors.push(`Field "${field.label}" references unknown field "${field.showIf.field}"`);
    }
  }
  return errors;
}
