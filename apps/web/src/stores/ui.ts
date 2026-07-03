import { defineStore } from 'pinia';

export type Theme = 'auto' | 'light' | 'dark';

const THEME_KEY = 'tickets.theme';
const EMBEDDED_KEY = 'tickets.embedded';

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: (localStorage.getItem(THEME_KEY) as Theme) || 'auto',
    /** True when running inside the Nextcloud External-sites iframe (?embedded=1). */
    embedded: sessionStorage.getItem(EMBEDDED_KEY) === '1',
  }),
  actions: {
    init() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('embedded') === '1' || window.self !== window.top) {
        this.embedded = true;
        sessionStorage.setItem(EMBEDDED_KEY, '1');
      }
      this.applyTheme();
    },
    setTheme(theme: Theme) {
      this.theme = theme;
      localStorage.setItem(THEME_KEY, theme);
      this.applyTheme();
    },
    cycleTheme() {
      const order: Theme[] = ['auto', 'light', 'dark'];
      this.setTheme(order[(order.indexOf(this.theme) + 1) % order.length]);
    },
    applyTheme() {
      document.documentElement.setAttribute('data-theme', this.theme);
    },
  },
});
