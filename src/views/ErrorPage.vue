<template>
  <main class="error-page">
    <nav class="error-nav" :aria-label="$t('home_navigation')">
      <RouterLink to="/" class="wordmark">FOODBOARD</RouterLink>
      <RouterLink to="/login" class="btn btn-quiet">{{ $t('nav_sign_in') }}</RouterLink>
    </nav>

    <section aria-labelledby="error-title">
      <span>404</span>
      <h1 id="error-title">{{ $t('error_title') }}</h1>
      <p>{{ $t('error_text') }}</p>
      <div class="error-actions">
        <RouterLink to="/" class="btn btn-primary">{{ $t('error_home') }}</RouterLink>
        <RouterLink to="/login" class="btn btn-quiet">{{ $t('nav_sign_in') }}</RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.error-page { min-height: 100dvh; display: grid; grid-template-rows: auto 1fr; padding: 0 var(--s-4); background: var(--c-bg); }
.error-nav { width: min(100%, var(--page-max)); min-height: 76px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: var(--s-4); border-bottom: 1px solid var(--c-line); }
.wordmark { color: var(--c-brand); font-size: .95rem; font-weight: 800; letter-spacing: .04em; }
.error-page section { width: min(100%, 620px); margin: auto; padding: var(--s-7) 0; text-align: center; }
.error-page section > span { display: inline-block; color: var(--c-brand); font-size: .78rem; font-weight: 800; letter-spacing: .12em; }
.error-page h1 { margin-top: var(--s-3); font-size: clamp(2rem, 7vw, 3.5rem); line-height: 1.05; letter-spacing: -.04em; text-wrap: balance; }
.error-page p { max-width: 52ch; margin: var(--s-4) auto var(--s-5); color: var(--c-ink-2); line-height: 1.6; text-wrap: pretty; }
.error-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: var(--s-2); }
@media (max-width: 420px) { .error-actions .btn { flex: 1 1 100%; } }
</style>
