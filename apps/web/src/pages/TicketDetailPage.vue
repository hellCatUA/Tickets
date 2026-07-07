<script setup lang="ts">
import {
  CommentDto,
  isFieldVisible,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TicketDetailDto,
  TicketEventDto,
  TicketPriority,
  TicketStatus,
  UserRefDto,
} from '@tickets/shared';
import { io, Socket } from 'socket.io-client';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import PriorityBadge from '../components/PriorityBadge.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { TicketsApi, UsersApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const auth = useAuthStore();
const ticketId = route.params.id as string;

const ticket = ref<TicketDetailDto | null>(null);
const users = ref<UserRefDto[]>([]);
const error = ref('');
const commentBody = ref('');
const commentInternal = ref(false);
const sending = ref(false);
const uploading = ref(false);
let socket: Socket | null = null;

const isManagerViewer = computed(() => auth.roles.includes('manager' as never));

async function load(): Promise<void> {
  try {
    ticket.value = await TicketsApi.detail(ticketId);
  } catch (err) {
    error.value = (err as Error).message;
  }
}

onMounted(async () => {
  await load();
  if (ticket.value?.canManage && isManagerViewer.value) {
    users.value = await UsersApi.list().catch(() => []);
  }
  socket = io({ path: '/socket.io' });
  socket.emit('ticket:join', ticketId);
  socket.on('ticket:update', () => void load());
});

onBeforeUnmount(() => {
  socket?.emit('ticket:leave', ticketId);
  socket?.disconnect();
});

async function run(action: () => Promise<TicketDetailDto>): Promise<void> {
  error.value = '';
  try {
    ticket.value = await action();
  } catch (err) {
    error.value = (err as Error).message;
  }
}

function onStatus(event: Event): void {
  const status = (event.target as HTMLSelectElement).value as TicketStatus;
  void run(() => TicketsApi.setStatus(ticketId, status));
}

function onPriority(event: Event): void {
  const priority = (event.target as HTMLSelectElement).value as TicketPriority;
  void run(() => TicketsApi.setPriority(ticketId, priority));
}

function onAssign(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  void run(() => TicketsApi.assign(ticketId, value || null));
}

function takeTicket(): void {
  if (auth.me) void run(() => TicketsApi.assign(ticketId, auth.me!.id));
}

function cancelTicket(): void {
  void run(() => TicketsApi.setStatus(ticketId, TicketStatus.Cancelled));
}

async function sendComment(): Promise<void> {
  if (!commentBody.value.trim()) return;
  sending.value = true;
  error.value = '';
  try {
    await TicketsApi.comment(ticketId, commentBody.value, commentInternal.value);
    commentBody.value = '';
    commentInternal.value = false;
    await load();
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    sending.value = false;
  }
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  error.value = '';
  try {
    await TicketsApi.upload(ticketId, file);
    await load();
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

// -------- timeline rendering --------

interface TimelineItem {
  id: string;
  createdAt: string;
  actorName: string;
  kind: 'comment' | 'event';
  comment?: CommentDto;
  text?: string;
}

const timeline = computed<TimelineItem[]>(() => {
  const t = ticket.value;
  if (!t) return [];
  const commentsById = new Map(t.comments.map((c) => [c.id, c]));
  const items: TimelineItem[] = [];
  for (const e of t.events) {
    const actorName = e.actor?.displayName ?? 'System';
    if (e.type === 'comment_added') {
      const comment = commentsById.get(e.payload.commentId as string);
      if (comment) {
        items.push({ id: e.id, createdAt: comment.createdAt, actorName, kind: 'comment', comment });
      }
      continue;
    }
    items.push({ id: e.id, createdAt: e.createdAt, actorName, kind: 'event', text: eventText(e) });
  }
  return items;
});

function eventText(e: TicketEventDto): string {
  const p = e.payload as Record<string, string>;
  switch (e.type) {
    case 'created':
      return `created ticket ${p.ticketNo}`;
    case 'status_changed':
      return `changed status: ${label(p.from)} → ${label(p.to)}${p.auto ? ' (auto)' : ''}`;
    case 'assigned':
      return p.assigneeName ? `assigned to ${p.assigneeName}` : 'removed the assignee';
    case 'priority_changed':
      return `changed priority: ${prioLabel(p.from)} → ${prioLabel(p.to)}`;
    case 'attachment_added':
      return `attached ${p.filename}`;
    case 'escalated':
      return `escalated to managers (unassigned for ${p.hours}h)`;
    default:
      return e.type;
  }
}

function label(status: string): string {
  return TICKET_STATUS_LABELS[status as TicketStatus] ?? status;
}

function prioLabel(priority: string): string {
  return TICKET_PRIORITY_LABELS[priority as TicketPriority] ?? priority;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}
</script>

<template>
  <div v-if="ticket" class="page">
    <div class="head">
      <div>
        <div class="no muted">{{ ticket.ticketNo }} · {{ ticket.categoryName }}</div>
        <h2>{{ ticket.title }}</h2>
        <div class="badges">
          <StatusBadge :status="ticket.status" />
          <PriorityBadge :priority="ticket.priority" />
        </div>
      </div>
      <div class="meta card">
        <div><span class="muted">Requester</span><span>{{ ticket.requester.displayName }}</span></div>
        <div><span class="muted">Assignee</span><span>{{ ticket.assignee?.displayName ?? '—' }}</span></div>
        <div v-if="ticket.locationName">
          <span class="muted">Location</span><span>{{ ticket.locationName }}</span>
        </div>
        <div v-if="ticket.objectName">
          <span class="muted">Object</span>
          <span>
            <router-link v-if="ticket.canManage" :to="`/assets/objects/${ticket.objectId}`">
              {{ ticket.objectName }}
            </router-link>
            <template v-else>{{ ticket.objectName }}</template>
          </span>
        </div>
        <div><span class="muted">Created</span><span>{{ formatDate(ticket.createdAt) }}</span></div>
        <div><span class="muted">Updated</span><span>{{ formatDate(ticket.updatedAt) }}</span></div>
      </div>
    </div>

    <div v-if="ticket.canManage || ticket.canCancel" class="card controls">
      <template v-if="ticket.canManage">
        <div class="control">
          <label class="mini">Status</label>
          <select :value="ticket.status" @change="onStatus">
            <option v-for="(l, value) in TICKET_STATUS_LABELS" :key="value" :value="value">
              {{ l }}
            </option>
          </select>
        </div>
        <div class="control">
          <label class="mini">Priority</label>
          <select :value="ticket.priority" @change="onPriority">
            <option v-for="(l, value) in TICKET_PRIORITY_LABELS" :key="value" :value="value">
              {{ l }}
            </option>
          </select>
        </div>
        <div class="control">
          <label class="mini">Assignee</label>
          <select v-if="isManagerViewer" :value="ticket.assignee?.id ?? ''" @change="onAssign">
            <option value="">Unassigned</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.displayName }}</option>
          </select>
          <button
            v-else-if="ticket.assignee?.id !== auth.me?.id"
            class="btn"
            type="button"
            @click="takeTicket"
          >
            Take ticket
          </button>
          <span v-else class="muted assigned-self">Assigned to you</span>
        </div>
      </template>
      <div v-if="ticket.canCancel && !ticket.canManage" class="control">
        <label class="mini">&nbsp;</label>
        <button class="btn" type="button" @click="cancelTicket">Cancel ticket</button>
      </div>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>

    <div class="columns">
      <div class="main">
        <div v-if="ticket.description" class="card">
          <h3>Description</h3>
          <p class="pre">{{ ticket.description }}</p>
        </div>

        <div class="card">
          <h3>Timeline</h3>
          <div class="timeline">
            <div v-for="item in timeline" :key="item.id" class="t-item">
              <template v-if="item.kind === 'comment' && item.comment">
                <div class="t-dot comment-dot" />
                <div class="t-body comment" :class="{ internal: item.comment.internal }">
                  <div class="t-head">
                    <strong>{{ item.comment.author.displayName }}</strong>
                    <span v-if="item.comment.internal" class="badge internal-badge">Internal</span>
                    <span class="muted t-date">{{ formatDate(item.createdAt) }}</span>
                  </div>
                  <p class="pre">{{ item.comment.body }}</p>
                </div>
              </template>
              <template v-else>
                <div class="t-dot" />
                <div class="t-body">
                  <span><strong>{{ item.actorName }}</strong> {{ item.text }}</span>
                  <span class="muted t-date">{{ formatDate(item.createdAt) }}</span>
                </div>
              </template>
            </div>
          </div>

          <form class="composer" @submit.prevent="sendComment">
            <textarea
              v-model="commentBody"
              rows="3"
              :placeholder="commentInternal ? 'Write an internal note…' : 'Write a comment…'"
            />
            <div class="composer-row">
              <label v-if="ticket.canInternal" class="check">
                <input v-model="commentInternal" type="checkbox" />
                Internal note (staff only)
              </label>
              <span class="spacer" />
              <button class="btn btn-primary" type="submit" :disabled="sending || !commentBody.trim()">
                {{ sending ? 'Sending…' : commentInternal ? 'Add note' : 'Comment' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="side">
        <div v-if="ticket.formFields.length > 0" class="card">
          <h3>Details</h3>
          <dl class="props">
            <template v-for="field in ticket.formFields" :key="field.key">
              <template v-if="isFieldVisible(field, ticket.formValues)">
                <dt class="muted">{{ field.label }}</dt>
                <dd>{{ formatValue(ticket.formValues[field.key]) }}</dd>
              </template>
            </template>
          </dl>
        </div>

        <div class="card">
          <h3>Attachments</h3>
          <p v-if="ticket.attachments.length === 0" class="muted">No attachments.</p>
          <ul class="files">
            <li v-for="a in ticket.attachments" :key="a.id">
              <a :href="`/api/attachments/${a.id}/download`">{{ a.filename }}</a>
              <span class="muted"> · {{ formatSize(a.size) }} · {{ a.uploader.displayName }}</span>
            </li>
          </ul>
          <label class="btn upload">
            {{ uploading ? 'Uploading…' : '+ Attach file' }}
            <input type="file" hidden :disabled="uploading" @change="onFile" />
          </label>
        </div>
      </div>
    </div>
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
  margin: 0.15rem 0 0.5rem;
}

.no {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

.badges {
  display: flex;
  gap: 0.5rem;
}

.meta {
  display: grid;
  grid-template-columns: auto auto;
  gap: 0.3rem 1.25rem;
  padding: 0.9rem 1.1rem;
  align-self: flex-start;
}

.meta > div {
  display: contents;
}

.controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.control {
  min-width: 170px;
}

.control select {
  width: 100%;
}

.mini {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}

.assigned-self {
  display: inline-block;
  padding: 0.45rem 0;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 320px;
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

.pre {
  white-space: pre-wrap;
  margin: 0;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.t-item {
  display: flex;
  gap: 0.6rem;
}

.t-dot {
  width: 9px;
  height: 9px;
  margin-top: 0.45rem;
  border-radius: 50%;
  background: var(--border);
  flex-shrink: 0;
}

.comment-dot {
  background: var(--accent);
}

.t-body {
  flex: 1;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.92rem;
}

.t-body.comment {
  display: block;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.6rem 0.8rem;
}

.t-body.comment.internal {
  background: rgba(224, 154, 34, 0.08);
  border-color: rgba(224, 154, 34, 0.35);
}

.internal-badge {
  background: rgba(224, 154, 34, 0.16);
  border-color: rgba(224, 154, 34, 0.4);
  color: #d08a12;
}

.t-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.t-date {
  font-size: 0.8rem;
  white-space: nowrap;
}

.composer textarea {
  margin-bottom: 0.5rem;
}

.composer-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}

.spacer {
  flex: 1;
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

.files {
  margin: 0 0 0.75rem;
  padding-left: 1.1rem;
}

.upload {
  display: inline-flex;
}

@media (max-width: 900px) {
  .columns {
    grid-template-columns: 1fr;
  }
}
</style>
