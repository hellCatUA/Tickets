<script setup lang="ts">
import { TICKET_STATUS_LABELS, TicketStatus } from '@tickets/shared';
import { computed } from 'vue';

const props = defineProps<{ status: TicketStatus }>();
const label = computed(() => TICKET_STATUS_LABELS[props.status] ?? props.status);
</script>

<template>
  <span class="status" :class="`s-${props.status}`">{{ label }}</span>
</template>

<style scoped>
.status {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap;
}

.s-new {
  background: rgba(47, 111, 237, 0.14);
  color: var(--accent);
  border-color: rgba(47, 111, 237, 0.35);
}

.s-in_progress {
  background: rgba(155, 89, 217, 0.14);
  color: #9b59d9;
  border-color: rgba(155, 89, 217, 0.35);
}

.s-waiting_for_requester,
.s-waiting_for_vendor {
  background: rgba(224, 154, 34, 0.14);
  color: #d08a12;
  border-color: rgba(224, 154, 34, 0.35);
}

.s-resolved {
  background: rgba(46, 160, 90, 0.14);
  color: #2ea05a;
  border-color: rgba(46, 160, 90, 0.35);
}

.s-closed {
  background: var(--surface-2);
  color: var(--text-muted);
  border-color: var(--border);
}

.s-cancelled {
  background: rgba(201, 64, 60, 0.12);
  color: var(--danger);
  border-color: rgba(201, 64, 60, 0.3);
}
</style>
