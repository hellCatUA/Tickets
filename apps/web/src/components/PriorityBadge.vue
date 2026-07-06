<script setup lang="ts">
import { TICKET_PRIORITY_LABELS, TicketPriority } from '@tickets/shared';
import { computed } from 'vue';

const props = defineProps<{ priority: TicketPriority }>();
const label = computed(() => TICKET_PRIORITY_LABELS[props.priority] ?? props.priority);
</script>

<template>
  <span class="prio" :class="`p-${props.priority}`">{{ label }}</span>
</template>

<style scoped>
.prio {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.p-low {
  background: var(--surface-2);
  color: var(--text-muted);
}

.p-normal {
  background: rgba(47, 111, 237, 0.12);
  color: var(--accent);
}

.p-high {
  background: rgba(224, 154, 34, 0.16);
  color: #d08a12;
}

.p-critical {
  background: rgba(201, 64, 60, 0.16);
  color: var(--danger);
}
</style>
