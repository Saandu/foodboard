import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Split vendor code out of the app bundle so the icon and Supabase libraries
// are cached independently of application changes.
//
// Rolldown (Vite 8) only accepts the function form of manualChunks. Rollup's
// old object form pulled each listed package's *whole* subtree into the chunk;
// a function is called per module and has to place the internals itself. The
// framework packages re-export from scoped siblings — `vue` from `@vue/*`,
// `vue-i18n` from `@intlify/*` — so matching only the top-level names would
// scatter those across unrelated chunks.
const VENDOR_CHUNKS = {
  vue: ['vue', 'vue-router', 'pinia', 'vue-i18n', '@vue', '@intlify'],
  supabase: ['@supabase'],
  icons: ['@fortawesome']
}

/**
 * The package a module belongs to: the path segment after the last
 * `node_modules/`, keeping the scope when there is one. Nested dependencies
 * resolve to the innermost package, which is what we want to place.
 */
const packageOf = (id) => {
  const segments = id.split('\\').join('/').split('node_modules/')
  if (segments.length < 2) return ''
  const [scopeOrName, name] = segments[segments.length - 1].split('/')
  return scopeOrName.startsWith('@') ? `${scopeOrName}/${name}` : scopeOrName
}

const manualChunks = (id) => {
  const pkg = packageOf(id)
  if (!pkg) return undefined
  const scope = pkg.split('/')[0]
  for (const [chunk, packages] of Object.entries(VENDOR_CHUNKS)) {
    if (packages.includes(pkg) || packages.includes(scope)) return chunk
  }
  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // Honour PORT so the dev server can be started alongside another instance.
    port: process.env.PORT ? Number(process.env.PORT) : 5173
  },
  build: {
    rollupOptions: {
      output: { manualChunks }
    }
  }
})
