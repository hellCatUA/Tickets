<script setup lang="ts">
import {
  CategoryDto,
  TICKET_STATUS_LABELS,
  TicketListDto,
  TicketStatus,
} from '@tickets/shared';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import PriorityBadge from '../components/PriorityBadge.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { CategoriesApi, TicketsApi } from '../lib/api';

const router = useRouter();

const list = ref<TicketListDto | null>(null);
const categories = ref<CategoryDto[]>([]);
const loading = ref(false);

const status = ref<TicketStatus | ''>('');
const categoryId = ref('');
const q = ref('');
const page = ref(1);

async function load(): Promise<void> {
  loading.value = true;
  try {
    list.value = await TicketsApi.list({
      status: status.value,
      categoryId: categoryId.value || undefined,
      q: q.value || undefined,
      page: page.value,
    });
  } finally {
    loading.value = false;
  }
}

watch([status, categoryId], () => {
  page.value = 1;
  void load();
});

watch(page, () => void load());

onMounted(async () => {
  categories.value = await CategoriesApi.list();
  await load();
});

function open(id: string): void {
  void router.push(`/tickets/${id}`);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <h2>Tickets</h2>
      <router-link class="btn btn-primary" to="/tickets/new">+ New ticket</router-link>
    </div>

    <div class="filters">
      <select v-model="status">
        <option value="">All statuses</option>
        <option v-for="(label, value) in TICKET_STATUS_LABELS" :key="value" :value="value">
          {{ label }}
        </option>
      </select>
      <select v-model="categoryId">
        <option value="">All categories</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <form class="search" @submit.prevent="page = 1; load()">
        <input v-model="q" type="search" placeholder="Search title or number…" />
        <button class="btn" type="submit">Search</button>
      </form>
    </div>

    <div v-if="loading && !list" class="muted">Loading…</div>
    <div v-else-if="list && list.items.length === 0" class="card empty">
      No tickets found.
      <router-link to="/tickets/new">Create the first one</router-link>
    </div>

    <div v-else-if="list" class="rows card">
      <div class="row header-row">
        <span>No.</span>
        <span>Title</span>
        <span>Category</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Assignee</span>
        <span>Updated</span>
      </div>
      <button
        v-for="t in list.items"
        :key="t.id"
        class="row item"
        type="button"
        @click="open(t.id)"
      >
        <span class="no">{{ t.ticketNo }}</span>
        <span class="title">{{ t.title }}</span>
        <span class="muted">{{ t.categoryName }}</span>
        <span><StatusBadge :status="t.status" /></span>
        <span><PriorityBadge :priority="t.priority" /></span>
        <span class="muted">{{ t.assignee?.displayName ?? '—' }}</span>
        <span class="muted date">{{ formatDate(t.updatedAt) }}</span>
      </button>
    </div>

    <div v-if="list && list.total > list.pageSize" class="pager">
      <button class="btn" type="button" :disabled="page <= 1" @click="page--">← Prev</button>
      <span class="muted">Page {{ page }} / {{ Math.ceil(list.total / list.pageSize) }}</span>
      <button
        class="btn"
        type="button"
        :disabled="page >= Math.ceil(list.total / list.pageSize)"
        @click="page++"
      >
        Next →
      </button>
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

.filters {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.filters select {
  width: auto;
  min-width: 160px;
}

.search {
  display: flex;
  gap: 0.4rem;
  flex: 1;
  min-width: 220px;
}

.rows {
  padding: 0;
  overflow: hidden;
}

.row {
  display: grid;
  grid-template-columns: 110px 1fr 140px 150px 100px 140px 160px;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  padding: 0.6rem 1rem;
  text-align: left;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font: inherit;
}

.header-row {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.item {
  cursor: pointer;
}

.item:hover {
  background: var(--surface-2);
}

.item:last-child {
  border-bottom: none;
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

.empty {
  text-align: center;
}

.pager {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
}

@media (max-width: 900px) {
  .header-row {
    display: none;
  }

  .row {
    grid-template-columns: 1fr 1fr;
    gap: 0.35rem;
  }

  .title {
    grid-column: 1 / -1;
    white-space: normal;
  }

  .date {
    text-align: right;
  }
}
</style>
