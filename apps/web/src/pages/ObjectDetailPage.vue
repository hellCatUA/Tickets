<script setup lang="ts">
import { AssetObjectDto, ObjectHistoryDto, Permission } from '@tickets/shared';
import QRCode from 'qrcode';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PriorityBadge from '../components/PriorityBadge.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { AssetsApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const objectId = route.params.id as string;

const object = ref<AssetObjectDto | null>(null);
const history = ref<ObjectHistoryDto | null>(null);
const qrDataUrl = ref('');
const error = ref('');

const canManage = computed(() => (auth.me?.permissions ?? []).includes(Permission.ManageObjects));

// new service entry form
const entryDate = ref(new Date().toISOString().slice(0, 10));
const entryDescription = ref('');
const entryPerformedBy = ref('');
const entryCost = ref<number | null>(null);

const qrUrl = computed(() =>
  object.value ? `${window.location.origin}/tickets/new?object=${object.value.qrToken}` : '',
);

onMounted(async () => {
  try {
    object.value = await AssetsApi.object(objectId);
    history.value = await AssetsApi.history(objectId);
    qrDataUrl.value = await QRCode.toDataURL(qrUrl.value, { width: 240, margin: 1 });
  } catch (err) {
    error.value = (err as Error).message;
  }
});

async function addEntry(): Promise<void> {
  error.value = '';
  try {
    await AssetsApi.addServiceEntry(objectId, {
      date: entryDate.value,
      description: entryDescription.value,
      performedBy: entryPerformedBy.value,
      cost: entryCost.value ?? 0,
    });
    entryDescription.value = '';
    entryPerformedBy.value = '';
    entryCost.value = null;
    history.value = await AssetsApi.history(objectId);
  } catch (err) {
    error.value = (err as Error).message;
  }
}

function printQr(): void {
  const win = window.open('', '_blank', 'width=420,height=560');
  if (!win || !object.value) return;
  win.document.write(`
    <html><head><title>QR — ${object.value.name}</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:24px">
      <img src="${qrDataUrl.value}" style="width:260px;height:260px" />
      <h2 style="margin:8px 0 2px">${object.value.name}</h2>
      <p style="margin:0;color:#555">SN: ${object.value.serialNo || '—'} · ${
        object.value.locationName ?? ''
      }</p>
      <p style="margin-top:10px;font-size:12px;color:#777">Scan to report an issue</p>
      <script>window.onload = () => window.print()<\/script>
    </body></html>`);
  win.document.close();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}
</script>

<template>
  <div v-if="object" class="page">
    <div class="head">
      <div>
        <div class="muted">{{ object.familyName }} · {{ object.locationName ?? 'No location' }}</div>
        <h2>{{ object.name }}</h2>
        <div class="muted mono">
          SN: {{ object.serialNo || '—' }} · Inv: {{ object.inventoryNo || '—' }}
        </div>
      </div>
      <div v-if="history" class="totals card">
        <div>
          <span class="t-value">{{ history.totals.tickets }}</span>
          <span class="t-label">tickets</span>
        </div>
        <div>
          <span class="t-value">{{ history.totals.services }}</span>
          <span class="t-label">service entries</span>
        </div>
        <div>
          <span class="t-value">${{ history.totals.totalCost.toFixed(2) }}</span>
          <span class="t-label">total spend</span>
        </div>
      </div>
    </div>

    <div class="columns">
      <div class="main">
        <div class="card">
          <h3>Ticket history</h3>
          <p v-if="!history || history.tickets.length === 0" class="muted">
            No tickets reference this object yet.
          </p>
          <div v-else class="tickets">
            <button
              v-for="t in history.tickets"
              :key="t.id"
              class="t-row"
              type="button"
              @click="router.push(`/tickets/${t.id}`)"
            >
              <span class="mono">{{ t.ticketNo }}</span>
              <span class="t-title">{{ t.title }}</span>
              <StatusBadge :status="t.status" />
              <PriorityBadge :priority="t.priority" />
            </button>
          </div>
        </div>

        <div class="card">
          <h3>Service log</h3>
          <p v-if="!history || history.entries.length === 0" class="muted">
            No manual service entries.
          </p>
          <table v-else class="log">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Performed by</th>
                <th class="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in history.entries" :key="e.id">
                <td class="mono">{{ e.date }}</td>
                <td>{{ e.description }}</td>
                <td class="muted">{{ e.performedBy || e.createdBy?.displayName || '—' }}</td>
                <td class="num">${{ e.cost.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>

          <form v-if="canManage" class="entry-form" @submit.prevent="addEntry">
            <div class="row">
              <input v-model="entryDate" type="date" class="date" />
              <input
                v-model="entryDescription"
                type="text"
                placeholder="What was done…"
                required
                class="grow"
              />
              <input v-model="entryPerformedBy" type="text" placeholder="Performed by" />
              <input v-model.number="entryCost" type="number" min="0" step="0.01" placeholder="Cost $" class="cost" />
              <button class="btn btn-primary" type="submit">Add</button>
            </div>
          </form>
        </div>
      </div>

      <div class="side">
        <div class="card qr-card">
          <h3>QR code</h3>
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code" class="qr" />
          <p class="muted small">Scanning opens a pre-filled new-ticket form for this object.</p>
          <button class="btn" type="button" @click="printQr">Print label</button>
        </div>

        <div v-if="object.familyFields.length > 0" class="card">
          <h3>Details</h3>
          <dl class="props">
            <template v-for="field in object.familyFields" :key="field.key">
              <dt class="muted">{{ field.label }}</dt>
              <dd>{{ formatValue(object.fields[field.key]) }}</dd>
            </template>
          </dl>
        </div>
      </div>
    </div>
    <p v-if="error" class="error-text">{{ error }}</p>
  </div>
  <div v-else-if="error" class="card error-text">{{ error }}</div>
  <div v-else class="muted">Loading…</div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 1100px;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.head h2 {
  margin: 0.15rem 0;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.86rem;
}

.totals {
  display: flex;
  gap: 1.5rem;
  padding: 0.8rem 1.2rem;
  align-self: flex-start;
}

.totals > div {
  display: flex;
  flex-direction: column;
}

.t-value {
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.t-label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.columns {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1rem;
  align-items: start;
}

.main,
.side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h3 {
  margin: 0 0 0.6rem;
}

.tickets {
  display: flex;
  flex-direction: column;
}

.t-row {
  display: grid;
  grid-template-columns: 110px 1fr auto auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.5rem 0.25rem;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.t-row:hover {
  background: var(--surface-2);
}

.t-row:last-child {
  border-bottom: none;
}

.t-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75rem;
}

.log th,
.log td {
  text-align: left;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.92rem;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.entry-form .row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.entry-form .date {
  width: 150px;
}

.entry-form .grow {
  flex: 1;
  min-width: 180px;
}

.entry-form .cost {
  width: 110px;
}

.qr-card {
  text-align: center;
}

.qr {
  width: 200px;
  height: 200px;
  border-radius: var(--radius);
  background: #fff;
  padding: 6px;
}

.small {
  font-size: 0.82rem;
}

.props {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem 0.8rem;
  margin: 0;
}

.props dd {
  margin: 0;
}

@media (max-width: 900px) {
  .columns {
    grid-template-columns: 1fr;
  }
}
</style>
