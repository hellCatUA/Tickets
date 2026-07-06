<script setup lang="ts">
import { Role } from '@tickets/shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';

const auth = useAuthStore();
const ui = useUiStore();
const route = useRoute();

const isAdmin = computed(() => auth.roles.includes(Role.Admin));
const isTicketsSection = computed(() => String(route.path).startsWith('/tickets'));

const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);

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
}

onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));
</script>

<template>
  <div class="shell" :class="{ embedded: ui.embedded }">
    <!-- Inside Nextcloud the host provides global chrome, so the top bar hides. -->
    <header v-if="!ui.embedded" class="topbar">
      <img class="brand-logo" :src="'/api/branding/logo'" alt="" @error="hideLogo" />
      <span class="brand">Tickets</span>
      <span class="spacer" />

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
