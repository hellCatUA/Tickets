<script setup lang="ts">
import { DashboardDto, TicketStatus } from '@tickets/shared';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PriorityBadge from '../components/PriorityBadge.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { DashboardApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const data = ref<DashboardDto | null>(null);

onMounted(async () => {
  data.value = await DashboardApi.get();
});

interface Tile {
  label: string;
  value: number;
  link?: string;
}

const tiles = computed<Tile[]>(() => {
  const d = data.value;
  if (!d) return [];
  const waiting =
    (d.openByStatus[TicketStatus.WaitingForRequester] ?? 0) +
    (d.openByStatus[TicketStatus.WaitingForVendor] ?? 0);
  const base: Tile[] = [
    { label: 'Open tickets', value: d.openTotal, link: '/tickets' },
    {
      label: 'New',
      value: d.openByStatus[TicketStatus.New] ?? 0,
      link: '/tickets?status=new',
    },
    {
      label: 'In progress',
      value: d.openByStatus[TicketStatus.InProgress] ?? 0,
      link: '/tickets?status=in_progress',
    },
    { label: 'Waiting', value: waiting },
  ];
  base.push(
    d.staff
      ? { label: 'Assigned to me', value: d.myAssignedOpen }
      : { label: 'My requests', value: d.myRequestedOpen },
  );
  return base;
});

const ALERT_META: Record<
  string,
  { text: (n: number) => string; tone: 'danger' | 'warn'; link: string }
> = {
  critical_open: {
    text: (n) => `${n} critical ticket${n > 1 ? 's' : ''} open`,
    tone: 'danger',
    link: '/tickets',
  },
  unassigned: {
    text: (n) => `${n} open ticket${n > 1 ? 's' : ''} without an assignee`,
    tone: 'warn',
    link: '/tickets?status=new',
  },
  stale: {
    text: (n) => `${n} ticket${n > 1 ? 's' : ''} with no updates for 7+ days`,
    tone: 'warn',
    link: '/tickets',
  },
  waiting_on_you: {
    text: (n) => `${n} ticket${n > 1 ? 's are' : ' is'} waiting for your reply`,
    tone: 'warn',
    link: '/tickets?status=waiting_for_requester',
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function open(id: string): void {
  void router.push(`/tickets/${id}`);
}
</script>

<template>
  <div v-if="data" class="page">
    <div class="welcome">
      <h2>Welcome, {{ auth.me?.displayName }}</h2>
      <router-link class="btn btn-primary" to="/tickets/new">+ New ticket</router-link>
    </div>

    <div class="tiles">
      <component
        :is="t.link ? 'router-link' : 'div'"
        v-for="t in tiles"
        :key="t.label"
        class="card tile"
        :to="t.link"
      >
        <span class="tile-value">{{ t.value }}</span>
        <span class="tile-label">{{ t.label }}</span>
      </component>
    </div>

    <div v-if="data.alerts.length > 0" class="card alerts">
      <h3>Alerts</h3>
      <router-link
        v-for="a in data.alerts"
        :key="a.kind"
        class="alert"
        :class="ALERT_META[a.kind]?.tone"
        :to="ALERT_META[a.kind]?.link ?? '/tickets'"
      >
        <span class="alert-icon" aria-hidden="true">{{
          ALERT_META[a.kind]?.tone === 'danger' ? '⚠' : '•'
        }}</span>
        {{ ALERT_META[a.kind]?.text(a.count) ?? `${a.kind}: ${a.count}` }}
      </router-link>
    </div>

    <div class="card">
      <h3>Active tickets</h3>
      <p v-if="data.recent.length === 0" class="muted">
        Nothing open right now.
        <router-link to="/tickets/new">Create a ticket</router-link>
      </p>
      <div v-else class="recent">
        <button
          v-for="t in data.recent"
          :key="t.id"
          class="recent-row"
          type="button"
          @click="open(t.id)"
        >
          <span class="no">{{ t.ticketNo }}</span>
          <span class="title">{{ t.title }}</span>
          <StatusBadge :status="t.status" />
          <PriorityBadge :priority="t.priority" />
          <span class="muted when">{{ formatDate(t.updatedAt) }}</span>
        </button>
      </div>
    </div>
  </div>
  <div v-else class="muted">Loading…</div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 1100px;
}

.welcome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.welcome h2 {
  margin: 0;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.tile {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.9rem 1.1rem;
  color: var(--text);
}

.tile[href]:hover {
  border-color: var(--accent);
}

.tile-value {
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.tile-label {
  color: var(--text-muted);
  font-size: 0.85rem;
}

h3 {
  margin: 0 0 0.6rem;
}

.alerts {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 0.92rem;
}

.alert.danger {
  background: rgba(201, 64, 60, 0.1);
  border-color: rgba(201, 64, 60, 0.35);
}

.alert.warn {
  background: rgba(224, 154, 34, 0.09);
  border-color: rgba(224, 154, 34, 0.32);
}

.alert:hover {
  filter: brightness(1.05);
}

.alert-icon {
  color: var(--danger);
}

.alert.warn .alert-icon {
  color: #d08a12;
}

.recent {
  display: flex;
  flex-direction: column;
}

.recent-row {
  display: grid;
  grid-template-columns: 110px 1fr auto auto 160px;
  gap: 0.6rem;
  align-items: center;
  width: 100%;
  padding: 0.55rem 0.25rem;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.recent-row:last-child {
  border-bottom: none;
}

.recent-row:hover {
  background: var(--surface-2);
}

.no {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

.title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.when {
  text-align: right;
  font-size: 0.85rem;
}

@media (max-width: 800px) {
  .recent-row {
    grid-template-columns: 1fr auto;
  }

  .no,
  .when {
    display: none;
  }
}
</style>
