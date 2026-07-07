<script setup lang="ts">
import { Role } from '@tickets/shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNotificationsStore } from '../stores/notifications';
import { useUiStore } from '../stores/ui';

const auth = useAuthStore();
const ui = useUiStore();
const notif = useNotificationsStore();
const route = useRoute();
const router = useRouter();

const isAdmin = computed(() => auth.roles.includes(Role.Admin));
const isTicketsSection = computed(() => String(route.path).startsWith('/tickets'));

const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const bellOpen = ref(false);
const bellRef = ref<HTMLElement | null>(null);

async function openNotification(id: string, ticketId: string | null): Promise<void> {
  bellOpen.value = false;
  await notif.markRead(id);
  if (ticketId) await router.push(`/tickets/${ticketId}`);
}

function formatWhen(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}h ago`;
  return new Date(iso).toLocaleDateString();
}

const themeLabel = computed(
  () => ({ auto: 'Auto', light: 'Light', dark: 'Dark' })[ui.theme],
);

const initials = computed(() => {
  const name = auth.me?.displayName ?? '';
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  );
});

function hideLogo(event: Event): void {
  (event.target as HTMLImageElement).style.display = 'none';
}

function onDocumentClick(event: MouseEvent): void {
  if (menuOpen.value && menuRef.value && !menuRef.value.contains(event.target as Node)) {
    menuOpen.value = false;
  }
  if (bellOpen.value && bellRef.value && !bellRef.value.contains(event.target as Node)) {
    bellOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  notif.connect();
});
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));
</script>

<template>
  <div class="shell" :class="{ embedded: ui.embedded }">
    <!-- Inside Nextcloud the host provides global chrome, so the top bar hides. -->
    <header v-if="!ui.embedded" class="topbar">
      <img class="brand-logo" :src="'/api/branding/logo'" alt="" @error="hideLogo" />
      <span class="brand">Tickets</span>
      <span class="spacer" />

      <div ref="bellRef" class="user-menu">
        <button
          class="bell-button"
          type="button"
          :title="`${notif.unreadCount} unread notifications`"
          @click="bellOpen = !bellOpen"
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          <span v-if="notif.unreadCount > 0" class="bell-badge">
            {{ notif.unreadCount > 99 ? '99+' : notif.unreadCount }}
          </span>
        </button>
        <div v-if="bellOpen" class="dropdown bell-dropdown">
          <div class="bell-head">
            <strong>Notifications</strong>
            <button
              v-if="notif.unreadCount > 0"
              class="mark-all"
              type="button"
              @click="notif.markAllRead()"
            >
              Mark all read
            </button>
          </div>
          <p v-if="notif.items.length === 0" class="bell-empty">Nothing here yet.</p>
          <button
            v-for="n in notif.items"
            :key="n.id"
            class="notif"
            :class="{ unread: !n.readAt }"
            type="button"
            @click="openNotification(n.id, n.ticketId)"
          >
            <span class="notif-title">{{ n.title }}</span>
            <span v-if="n.body" class="notif-body">{{ n.body }}</span>
            <span class="notif-when">{{ formatWhen(n.createdAt) }}</span>
          </button>
        </div>
      </div>

      <div ref="menuRef" class="user-menu">
        <button class="user-button" type="button" @click="menuOpen = !menuOpen">
          <span class="avatar">{{ initials }}</span>
          <span class="user-name">{{ auth.me?.displayName }}</span>
          <span class="chevron" :class="{ open: menuOpen }">▾</span>
        </button>
        <div v-if="menuOpen" class="dropdown">
          <div class="dropdown-header">
            <div class="dropdown-name">{{ auth.me?.displayName }}</div>
            <div v-if="auth.me?.email" class="dropdown-email">{{ auth.me?.email }}</div>
          </div>
          <button class="dropdown-item" type="button" @click="ui.cycleTheme()">
            <span>Theme</span>
            <span class="dropdown-value">{{ themeLabel }}</span>
          </button>
          <button
            class="dropdown-item"
            type="button"
            @click="
              menuOpen = false;
              router.push('/settings/notifications');
            "
          >
            Notification settings
          </button>
          <button class="dropdown-item danger" type="button" @click="auth.logout()">
            Sign out
          </button>
        </div>
      </div>
    </header>

    <div class="body">
      <nav class="sidenav">
        <router-link to="/">Dashboard</router-link>
        <router-link to="/tickets" :class="{ 'router-link-active': isTicketsSection }">
          Tickets
        </router-link>
        <router-link to="/tickets/new" class="new-ticket">+ New ticket</router-link>
        <template v-if="isAdmin">
          <span class="nav-section">Admin</span>
          <router-link to="/admin/categories">Categories</router-link>
          <router-link to="/admin/access">Access</router-link>
          <router-link to="/admin/automation">Automation</router-link>
        </template>
        <template v-if="ui.embedded">
          <button class="btn theme-mini" type="button" @click="ui.cycleTheme()">
            Theme: {{ themeLabel }}
          </button>
        </template>
      </nav>
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.brand {
  font-weight: 700;
}

.brand-logo {
  height: 26px;
  max-width: 120px;
  object-fit: contain;
}

.spacer {
  flex: 1;
}

.user-menu {
  position: relative;
}

.bell-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.bell-button:hover {
  background: var(--surface-2);
}

.bell-badge {
  position: absolute;
  top: 0;
  right: -2px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 17px;
  text-align: center;
}

.bell-dropdown {
  min-width: 320px;
  max-width: 380px;
  max-height: 420px;
  overflow: auto;
}

.bell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.65rem 0.55rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.3rem;
}

.mark-all {
  border: none;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.82rem;
}

.bell-empty {
  padding: 0.75rem;
  margin: 0;
  color: var(--text-muted);
  text-align: center;
}

.notif {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: none;
  border-radius: calc(var(--radius) - 4px);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.notif:hover {
  background: var(--surface-2);
}

.notif.unread .notif-title {
  font-weight: 700;
}

.notif.unread .notif-title::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--accent);
  vertical-align: middle;
}

.notif-body {
  font-size: 0.83rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notif-when {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.user-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.user-button:hover {
  background: var(--surface-2);
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 0.8rem;
  font-weight: 700;
}

.chevron {
  font-size: 0.7rem;
  color: var(--text-muted);
  transition: transform 0.15s ease;
}

.chevron.open {
  transform: rotate(180deg);
}

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 220px;
  padding: 0.35rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  z-index: 30;
}

.dropdown-header {
  padding: 0.5rem 0.65rem 0.6rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.35rem;
}

.dropdown-name {
  font-weight: 600;
}

.dropdown-email {
  font-size: 0.82rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: none;
  border-radius: calc(var(--radius) - 4px);
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--surface-2);
}

.dropdown-item.danger {
  color: var(--danger);
}

.dropdown-value {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.sidenav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 200px;
  padding: 1rem 0.75rem;
  border-right: 1px solid var(--border);
  background: var(--surface);
}

.sidenav a {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  color: var(--text);
}

.sidenav a.router-link-active {
  background: var(--surface-2);
  color: var(--accent);
  font-weight: 600;
}

.new-ticket {
  color: var(--accent);
}

.nav-section {
  margin-top: 0.75rem;
  padding: 0 0.75rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

@media (max-width: 720px) {
  .nav-section {
    display: none;
  }
}

.theme-mini {
  margin-top: auto;
  font-size: 0.85rem;
}

.content {
  flex: 1;
  overflow: auto;
  padding: 1.25rem;
}

/* Mobile: sidebar collapses to a top strip */
@media (max-width: 720px) {
  .body {
    flex-direction: column;
  }

  .sidenav {
    flex-direction: row;
    width: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 0.5rem 0.75rem;
  }

  .theme-mini {
    margin-top: 0;
    margin-left: auto;
  }

  .user-name {
    display: none;
  }
}
</style>
