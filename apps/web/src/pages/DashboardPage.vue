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
      <h3>Quick actions</h3>
      <p>
        <router-link class="btn btn-primary" to="/tickets/new">+ New ticket</router-link>
      </p>
      <p>
        <router-link class="btn" to="/tickets">Browse tickets</router-link>
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
