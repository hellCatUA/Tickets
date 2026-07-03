import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { useUiStore } from './stores/ui';
import './styles/main.css';

const app = createApp(App);
app.use(createPinia());

useUiStore().init();

app.use(router);
app.mount('#app');
