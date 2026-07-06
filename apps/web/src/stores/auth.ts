import type { MeDto } from '@tickets/shared';
import { defineStore } from 'pinia';
import { api, HttpError } from '../lib/http';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    me: null as MeDto | null,
    loaded: false,
  }),
  getters: {
    isAuthenticated: (s) => s.me !== null,
    roles: (s) => s.me?.roles ?? [],
  },
  actions: {
    async fetchMe(): Promise<void> {
      try {
        this.me = await api<MeDto>('/api/me');
      } catch (err) {
        if (err instanceof HttpError && (err.status === 401 || err.status === 404)) {
          this.me = null;
        } else {
          throw err;
        }
      } finally {
        this.loaded = true;
      }
    },
    login(returnTo?: string): void {
      const target = returnTo ?? window.location.pathname + window.location.search;
      window.location.href = `/auth/login?returnTo=${encodeURIComponent(target)}`;
    },
    async logout(): Promise<void> {
      await api<void>('/auth/logout', { method: 'POST' });
      this.me = null;
      // loggedout=1 keeps the login page from auto-starting SSO again,
      // which would instantly sign the user back in via the live NC session.
      window.location.href = '/login?loggedout=1';
    },
  },
});
