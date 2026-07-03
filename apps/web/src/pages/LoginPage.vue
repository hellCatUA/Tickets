<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();

const hasError = computed(() => route.query.error === 'oidc');
const returnTo = computed(() =>
  typeof route.query.returnTo === 'string' ? route.query.returnTo : undefined,
);
</script>

<template>
  <div class="login-wrap">
    <div class="card login-card">
      <h1>417 Tickets</h1>
      <p class="muted">Internal service-ticket platform</p>
      <p v-if="hasError" class="error">
        Sign-in with Nextcloud failed. Please try again or contact an administrator.
      </p>
      <button class="btn btn-primary" type="button" @click="auth.login(returnTo)">
        Sign in with Nextcloud
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 1rem;
}

.login-card {
  width: 100%;
  max-width: 360px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.login-card h1 {
  margin: 0;
}

.error {
  color: var(--danger);
}
</style>
