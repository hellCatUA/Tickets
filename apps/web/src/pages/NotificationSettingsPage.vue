<script setup lang="ts">
import {
  NOTIFICATION_EVENT_TYPES,
  NotificationEventType,
  NotificationPrefsDto,
} from '@tickets/shared';
import { onMounted, ref } from 'vue';
import { PreferencesApi, PushApi } from '../lib/api';

const data = ref<NotificationPrefsDto | null>(null);
const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
const pushEnabled = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');

const TYPE_LABELS: Record<NotificationEventType, string> = {
  status: 'Status changes',
  assigned: 'Assignment changes',
  comment: 'Comments',
  automation: 'Automatic actions',
  escalation: 'Escalations',
};

onMounted(async () => {
  data.value = await PreferencesApi.get();
  if (pushSupported) {
    const { subscribed } = await PushApi.status();
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    const sub = await registration?.pushManager.getSubscription();
    pushEnabled.value = Boolean(sub) && subscribed;
  }
});

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function enablePush(): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was denied');
    const registration = await navigator.serviceWorker.ready;
    const { key } = await PushApi.key();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await PushApi.subscribe(subscription.toJSON());
    pushEnabled.value = true;
    flash('Push enabled on this device.');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
  }
}

async function disablePush(): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await PushApi.unsubscribe(sub.endpoint);
      await sub.unsubscribe();
    }
    pushEnabled.value = false;
    flash('Push disabled on this device.');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
  }
}

async function save(): Promise<void> {
  if (!data.value) return;
  error.value = '';
  try {
    data.value = await PreferencesApi.put(data.value.prefs);
    flash('Preferences saved.');
  } catch (err) {
    error.value = (err as Error).message;
  }
}

function flash(message: string): void {
  notice.value = message;
  setTimeout(() => (notice.value = ''), 4000);
}
</script>

<template>
  <div v-if="data" class="page">
    <h2>Notification settings</h2>

    <div class="card section">
      <h3>Push on this device</h3>
      <p class="muted desc">
        Get notifications on this device even when the tab is closed. On iPhone/iPad this
        requires adding the app to the Home Screen first.
      </p>
      <p v-if="!pushSupported" class="muted">This browser does not support Web Push.</p>
      <div v-else class="actions">
        <button
          v-if="!pushEnabled"
          class="btn btn-primary"
          type="button"
          :disabled="busy"
          @click="enablePush"
        >
          Enable push notifications
        </button>
        <button v-else class="btn" type="button" :disabled="busy" @click="disablePush">
          Disable push on this device
        </button>
      </div>
    </div>

    <div class="card section">
      <h3>What to send</h3>
      <p class="muted desc">The in-app bell always shows everything; tune the other channels.</p>
      <table class="prefs">
        <thead>
          <tr>
            <th>Event</th>
            <th>Push</th>
            <th v-if="data.channels.email">Email</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="type in NOTIFICATION_EVENT_TYPES" :key="type">
            <td>{{ TYPE_LABELS[type] }}</td>
            <td><input v-model="data.prefs.push[type]" type="checkbox" /></td>
            <td v-if="data.channels.email">
              <input v-model="data.prefs.email[type]" type="checkbox" />
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!data.channels.email" class="muted desc">
        Email notifications are ready but disabled — the server has no SMTP configured yet.
      </p>
      <div class="actions">
        <button class="btn btn-primary" type="button" @click="save">Save preferences</button>
      </div>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-if="notice" class="notice">{{ notice }}</p>
  </div>
  <div v-else class="muted">Loading…</div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 560px;
}

.page h2 {
  margin: 0;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.section h3 {
  margin: 0;
}

.desc {
  margin: 0;
  font-size: 0.88rem;
}

.prefs {
  border-collapse: collapse;
  width: 100%;
}

.prefs th,
.prefs td {
  text-align: left;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border);
}

.prefs th:not(:first-child),
.prefs td:not(:first-child) {
  text-align: center;
  width: 70px;
}

.prefs input {
  width: auto;
}

.actions {
  display: flex;
  gap: 0.6rem;
}

.notice {
  color: #2ea05a;
  font-size: 0.9rem;
}
</style>
