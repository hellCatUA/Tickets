<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';

const auth = useAuthStore();
const ui = useUiStore();

const themeLabel = computed(
  () => ({ auto: 'Auto', light: 'Light', dark: 'Dark' })[ui.theme],
);
</script>

<template>
  <div class="shell" :class="{ embedded: ui.embedded }">
    <!-- Inside Nextcloud the host provides global chrome, so the top bar hides. -->
    <header v-if="!ui.embedded" class="topbar">
      <span class="brand">417 Tickets</span>
      <span class="spacer" />
      <button class="btn" type="button" @click="ui.cycleTheme()">Theme: {{ themeLabel }}</button>
      <span class="user">{{ auth.me?.displayName }}</span>
      <button class="btn" type="button" @click="auth.logout()">Sign out</button>
    </header>

    <div class="body">
      <nav class="sidenav">
        <router-link to="/">Dashboard</router-link>
        <router-link to="/tickets">Tickets</router-link>
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
  padding: 0.6rem 1rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.brand {
  font-weight: 700;
}

.spacer {
  flex: 1;
}

.user {
  color: var(--text-muted);
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
}
</style>
