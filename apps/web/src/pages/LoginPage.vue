<script setup lang="ts">
import { computed } from 'vue';
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
</script>

<template>
  <div class="login-screen">
    <img class="logo" :src="'/api/branding/logo'" alt="" @error="hideLogo" />
    <div class="login-card">
      <h1>Log in to Tickets</h1>
      <p v-if="hasError" class="message error">
        Sign-in failed. Please try again or contact an administrator.
      </p>
      <p v-else-if="loggedOut" class="message">You have been signed out.</p>
      <p v-else class="message">Continue with your 417 Cloud account.</p>
      <button class="login-btn" type="button" @click="auth.login(returnTo)">
        <span aria-hidden="true">→</span> Log in
      </button>
    </div>
    <footer class="footer">Tickets — 417 Group</footer>
  </div>
</template>

<style scoped>
/* Styled after the Nextcloud login screen; always dark, theme-independent. */
.login-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.75rem;
  min-height: 100%;
  padding: 1.5rem;
  background:
    radial-gradient(ellipse at 50% -20%, rgba(83, 70, 255, 0.55), transparent 60%),
    linear-gradient(180deg, #2317d6 0%, #171065 45%, #0b0a18 100%);
}

.logo {
  max-height: 90px;
  max-width: 220px;
  object-fit: contain;
}

.login-card {
  width: 100%;
  max-width: 340px;
  padding: 1.5rem 1.5rem 1.75rem;
  border-radius: 14px;
  background: rgba(16, 14, 26, 0.88);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.45);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-card h1 {
  margin: 0;
  font-size: 1.25rem;
  color: #ffffff;
}

.message {
  margin: 0;
  font-size: 0.9rem;
  color: #b9b6cc;
}

.message.error {
  color: #ff8a86;
}

.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.65rem 1rem;
  border: none;
  border-radius: 10px;
  background: #d8d8dd;
  color: #1b1b22;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.login-btn:hover {
  background: #ffffff;
}

.footer {
  position: fixed;
  bottom: 1rem;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
}
</style>
