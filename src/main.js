import './assets/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';

import './config/firebase';

// iOS Safari only applies :active on touch when the page listens for touchstart (ui.css, .ui-btn:active).
document.addEventListener('touchstart', () => {}, { passive: true });

const app = createApp(App);
app.use(router);
app.use(createPinia());
app.mount('#app');
