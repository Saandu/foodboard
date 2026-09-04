import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import it from './locales/it.json'
import ro from './locales/ro.json'

const pinia = createPinia()

const i18n = createI18n({
  legacy: false,
  locale: 'en', // default
  fallbackLocale: 'en',
  messages: { en, it, ro }
})

createApp(App)
  .use(pinia)
  .use(router)
  .use(i18n)
  .mount('#app')
