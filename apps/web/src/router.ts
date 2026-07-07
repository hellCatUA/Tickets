import { Role } from '@tickets/shared';
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: () => import('./pages/DashboardPage.vue') },
    { path: '/tickets', name: 'tickets', component: () => import('./pages/TicketsPage.vue') },
    {
      path: '/tickets/new',
      name: 'new-ticket',
      component: () => import('./pages/NewTicketPage.vue'),
    },
    {
      path: '/tickets/:id',
      name: 'ticket-detail',
      component: () => import('./pages/TicketDetailPage.vue'),
    },
    {
      path: '/admin/categories',
      name: 'admin-categories',
      component: () => import('./pages/AdminCategoriesPage.vue'),
      meta: { role: Role.Admin },
    },
    {
      path: '/assets/locations',
      name: 'assets-locations',
      component: () => import('./pages/AssetsLocationsPage.vue'),
    },
    {
      path: '/assets/families',
      name: 'assets-families',
      component: () => import('./pages/AssetsFamiliesPage.vue'),
    },
    {
      path: '/assets/objects',
      name: 'assets-objects',
      component: () => import('./pages/AssetsObjectsPage.vue'),
    },
    {
      path: '/assets/objects/:id',
      name: 'object-detail',
      component: () => import('./pages/ObjectDetailPage.vue'),
    },
    {
      path: '/settings/notifications',
      name: 'notification-settings',
      component: () => import('./pages/NotificationSettingsPage.vue'),
    },
    {
      path: '/admin/access',
      name: 'admin-access',
      component: () => import('./pages/AdminAccessPage.vue'),
      meta: { role: Role.Admin },
    },
    {
      path: '/admin/automation',
      name: 'admin-automation',
      component: () => import('./pages/AdminAutomationPage.vue'),
      meta: { role: Role.Admin },
    },
    {
      path: '/admin/maintenance',
      name: 'admin-maintenance',
      component: () => import('./pages/AdminMaintenancePage.vue'),
      meta: { role: Role.Admin },
    },
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
  if (to.meta.role && !auth.roles.includes(to.meta.role as Role)) return { path: '/' };
  return true;
});
