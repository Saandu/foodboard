import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // Honour PORT so the dev server can be started alongside another instance.
    port: process.env.PORT ? Number(process.env.PORT) : 5173
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendor code out of the app bundle so the icon and Supabase
        // libraries are cached independently of application changes.
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia', 'vue-i18n'],
          supabase: ['@supabase/supabase-js'],
          icons: [
            '@fortawesome/fontawesome-svg-core',
            '@fortawesome/free-solid-svg-icons',
            '@fortawesome/vue-fontawesome'
          ]
        }
      }
    }
  }
})
