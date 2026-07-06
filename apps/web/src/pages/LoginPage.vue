<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();

const hasError = computed(() => route.query.error === 'oidc');
const loggedOut = computed(() => route.query.loggedout === '1');
const returnTo = computed(() =>
  typeof route.query.returnTo === 'string' ? route.query.returnTo : undefined,
);

function hideLogo(event: Event): void {
  (event.target as HTMLImageElement).style.display = 'none';
}

// Plain visits forward straight to Nextcloud sign-in. After an explicit
// logout or a failed flow the page waits for the user instead of looping.
onMounted(() => {
  if (!hasError.value && !loggedOut.value) auth.login(returnTo.value);
});
</script>

<template>
  <div class="login-wrap">
    <div class="card login-card">
      <img class="logo" :src="'/api/branding/logo'" alt="" @error="hideLogo" />
      <h1>Tickets</h1>
      <template v-if="hasError">
        <p class="error">
          Sign-in with Nextcloud failed. Please try again or contact an administrator.
        </p>
        <button class="btn btn-primary" type="button" @click="auth.login(returnTo)">
          Try again
        </button>
      </template>
      <template v-else-if="loggedOut">
        <p class="muted">You have been signed out.</p>
        <button class="btn btn-primary" type="button" @click="auth.login()">
          Sign in with Nextcloud
        </button>
      </template>
      <p v-else class="muted">Redirecting to Nextcloud sign-in…</p>
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

.logo {
  max-height: 48px;
  max-width: 200px;
  align-self: center;
  object-fit: contain;
}

.error {
  color: var(--danger);
}
</style>
