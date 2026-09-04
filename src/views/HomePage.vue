<template>
  <main class="home-page">
    <header class="home-nav">
      <router-link to="/" class="home-brand">FOOD<span>BOARD</span></router-link>
      <div>
        <LanguagePicker :model-value="$i18n.locale" :options="languageOptions" :label="$t('language')" @update:model-value="$i18n.locale = $event" />
        <router-link class="home-signin" to="/login">{{ $t('nav_sign_in') }}</router-link>
        <router-link class="btn btn-primary" to="/register">{{ $t('nav_create_account') }}</router-link>
      </div>
    </header>

    <section class="home-hero">
      <div>
        <p class="home-kicker">{{ $t('home_kicker') }}</p>
        <h1>{{ $t('home_title') }}</h1>
        <p class="home-lede">{{ $t('home_lede') }}</p>
        <div class="home-actions">
          <router-link class="btn btn-primary" to="/register">{{ $t('home_cta_primary') }}</router-link>
          <a class="btn btn-quiet" :href="examples[0].href" target="_blank" rel="noopener">{{ $t('home_example_open') }} &rarr;</a>
        </div>
      </div>
      <aside class="home-preview"><div class="home-preview__bar"><span></span><span></span><span></span></div><p>Trattoria Mareluna</p><small>MENU · ITALIANO</small><hr><strong>Antipasti</strong><div><b>Crudo di Ricciola</b><em>18 €</em></div><div><b>Burrata e Pomodorini</b><em>14 €</em></div><div><b>Vitello Tonnato</b><em>16 €</em></div></aside>
    </section>

    <!-- Real published menus, so the product can be judged without signing up. -->
    <section class="home-examples">
      <h2>{{ $t('home_examples_title') }}</h2>
      <p class="home-examples__lede">{{ $t('home_examples_lede') }}</p>
      <div class="home-examples__grid">
        <a v-for="example in examples" :key="example.href" class="home-example" :href="example.href" target="_blank" rel="noopener">
          <span class="home-example__name">{{ example.name }}</span>
          <span class="home-example__note">{{ $t(example.noteKey) }}</span>
          <span class="home-example__cta">{{ $t('home_example_open') }} &rarr;</span>
        </a>
      </div>
    </section>

    <section class="home-features">
      <article><h2>{{ $t('home_feature_1_title') }}</h2><p>{{ $t('home_feature_1_text') }}</p></article>
      <article><h2>{{ $t('home_feature_2_title') }}</h2><p>{{ $t('home_feature_2_text') }}</p></article>
      <article><h2>{{ $t('home_feature_3_title') }}</h2><p>{{ $t('home_feature_3_text') }}</p></article>
    </section>
  </main>
</template>

<script setup>
import LanguagePicker from '../components/LanguagePicker.vue'
import { UI_LANGUAGES } from '../uiLanguages.js'

const languageOptions = UI_LANGUAGES

/**
 * Menus published from the showcase account. These are the real customer-facing
 * pages, not mock-ups, so a visitor can judge the output before signing up.
 */
const examples = [
  { name: 'Trattoria Mareluna', href: '/menu/trattoria-mareluna', noteKey: 'home_example_1_note' },
  { name: 'Caffè Mareluna', href: '/menu/caffe-mareluna', noteKey: 'home_example_2_note' }
]
</script>

<style scoped>
.home-page { min-height: 100dvh; padding: var(--s-5); background: var(--c-bg); }.home-nav, .home-hero, .home-features { width: min(100%, 1120px); margin: 0 auto; }.home-nav { display: flex; justify-content: space-between; align-items: center; gap: var(--s-4); }.home-nav > div { display: flex; align-items: center; gap: var(--s-3); flex-wrap: wrap; justify-content: flex-end; }.home-brand { color: var(--c-ink); font-size: 1.15rem; font-weight: 800; letter-spacing: .08em; }.home-brand span { color: var(--c-brand); }.home-signin { color: var(--c-ink-2); font-size: .9rem; font-weight: 700; }.home-signin:hover { color: var(--c-brand); }.home-hero { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr); gap: clamp(var(--s-7), 9vw, 112px); align-items: center; padding: clamp(80px, 15vh, 144px) 0 var(--s-8); }.home-kicker { color: var(--c-brand); font-size: .8rem; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }.home-hero h1 { max-width: 11ch; margin-top: var(--s-3); color: var(--c-ink); font-size: 3.6rem; line-height: 1.04; letter-spacing: -.035em; text-wrap: balance; }.home-lede { max-width: 58ch; margin-top: var(--s-5); color: var(--c-ink-2); font-size: 1.05rem; line-height: 1.6; }.home-actions { display: flex; flex-wrap: wrap; gap: var(--s-3); margin-top: var(--s-6); }.home-preview { padding: var(--s-5); background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-md); box-shadow: var(--shadow-md); }.home-preview__bar { display: flex; gap: 5px; margin-bottom: var(--s-6); }.home-preview__bar span { width: 8px; height: 8px; border-radius: 50%; background: var(--c-line-strong); }.home-preview p { color: var(--c-ink); font-family: Fraunces, serif; font-size: 1.65rem; font-weight: 600; }.home-preview small { display: block; margin-top: var(--s-2); color: var(--c-ink-3); font-size: .7rem; font-weight: 750; letter-spacing: .06em; }.home-preview hr { margin: var(--s-5) 0; border: 0; border-top: 1px solid var(--c-line); }.home-preview strong { color: var(--c-brand); font-size: .82rem; text-transform: uppercase; letter-spacing: .05em; }.home-preview div:not(.home-preview__bar) { display: flex; justify-content: space-between; gap: var(--s-3); padding: var(--s-3) 0; color: var(--c-ink); border-bottom: 1px solid var(--c-line-2); font-size: .92rem; }.home-preview em { color: var(--c-ink-2); font-style: normal; }.home-examples { width: min(100%, 1120px); margin: 0 auto; padding: 0 0 var(--s-7); }.home-examples h2 { color: var(--c-ink); font-size: 1.5rem; letter-spacing: -.02em; }.home-examples__lede { margin-top: var(--s-2); color: var(--c-ink-2); font-size: .95rem; line-height: 1.55; max-width: 62ch; }.home-examples__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-4); margin-top: var(--s-5); }.home-example { display: flex; flex-direction: column; gap: var(--s-2); padding: var(--s-5); background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-md); transition: border-color .18s ease, box-shadow .18s ease; }.home-example:hover { border-color: var(--c-brand); box-shadow: var(--shadow-md); }.home-example__name { color: var(--c-ink); font-family: Fraunces, serif; font-size: 1.3rem; font-weight: 600; }.home-example__note { color: var(--c-ink-2); font-size: .9rem; line-height: 1.5; }.home-example__cta { margin-top: var(--s-2); color: var(--c-brand); font-size: .88rem; font-weight: 750; } @media (max-width: 760px) { .home-examples__grid { grid-template-columns: 1fr; } }.home-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-5); padding: 0 0 var(--s-7); }.home-features article { padding-top: var(--s-4); border-top: 1px solid var(--c-line-strong); }.home-features h2 { color: var(--c-ink); font-size: 1rem; }.home-features p { margin-top: var(--s-2); color: var(--c-ink-2); font-size: .92rem; line-height: 1.55; } @media (max-width: 760px) { .home-page { padding: var(--s-4); }.home-hero { grid-template-columns: 1fr; gap: var(--s-6); padding: var(--s-8) 0 var(--s-7); }.home-hero h1 { font-size: 2.55rem; }.home-preview { max-width: 420px; }.home-features { grid-template-columns: 1fr; gap: var(--s-4); } } @media (max-width: 420px) { .home-signin { display: none; }.home-hero h1 { font-size: 2.15rem; } }
</style>
