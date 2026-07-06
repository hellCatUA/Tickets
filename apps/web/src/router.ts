import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: () => import('./pages/DashboardPage.vue') },
    { path: '/tickets', name: 'tickets', component: () => import('./pages/TicketsPage.vue') },
    {
      path: '/login',
      name: 'login',
      component: () => import('./pages/LoginPage.vue'),
      meta: { public: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.loaded) await auth.fetchMe();
  // A signed-in user has no business on the login page (e.g. a stale
  // ?error=oidc URL refreshed after a later successful sign-in) — go home.
  if (to.name === 'login' && auth.isAuthenticated) return { path: '/' };
  if (to.meta.public) return true;
  if (!auth.isAuthenticated) {
    // Land on the login screen as an explicit acknowledgement step — even
    // with a live Nextcloud session, signing in requires pressing "Log in".
    return {
      name: 'login',
      query: to.fullPath !== '/' ? { returnTo: to.fullPath } : {},
    };
  }
  return true;
});
