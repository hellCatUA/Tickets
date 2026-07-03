<script setup lang="ts">
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
</script>

<template>
  <div class="grid">
    <section class="card">
      <h2>Welcome, {{ auth.me?.displayName }}</h2>
      <p class="muted">Signed in via Nextcloud as <code>{{ auth.me?.ncUid }}</code></p>
      <p>
        <span v-for="role in auth.roles" :key="role" class="badge role">{{ role }}</span>
      </p>
    </section>

    <section class="card">
      <h3>Your Nextcloud groups</h3>
      <p v-if="auth.me?.groups.length === 0" class="muted">No groups.</p>
      <p>
        <span v-for="g in auth.me?.groups" :key="g" class="badge role">{{ g }}</span>
      </p>
    </section>

    <section class="card">
      <h3>Platform status</h3>
      <p class="muted">
        Milestone M0: SSO, directory sync and role mapping are live. Ticket management arrives in
        M1.
      </p>
    </section>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.role {
  margin-right: 0.35rem;
}

h2,
h3 {
  margin-top: 0;
}
</style>
