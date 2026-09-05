<template>
  <main class="auth-page">
    <nav class="auth-nav">
      <router-link to="/" class="auth-brand">FOOD<span>BOARD</span></router-link>
      <div class="auth-nav__end">
        <LanguagePicker :model-value="$i18n.locale" :options="languageOptions" :label="$t('language')" @update:model-value="$i18n.locale = $event" />
        <router-link class="auth-nav__link" :to="alternateRoute">{{ alternateLabel }}</router-link>
      </div>
    </nav>
    <section class="auth-card">
      <span class="auth-card__eyebrow">{{ $t('login_badge') }}</span>
      <h1>{{ $t(isForgot ? 'auth_forgot_title' : isRegister ? 'auth_register_title' : 'auth_signin_title') }}</h1>
      <p>{{ $t(isForgot ? 'auth_forgot_lede' : isRegister ? 'auth_register_lede' : 'auth_signin_lede') }}</p>
      <form class="auth-form" @submit.prevent="submit">
        <label v-if="isRegister"><span>{{ $t('auth_full_name') }}</span><input v-model.trim="fullName" autocomplete="name" required /></label>
        <label><span>{{ $t('auth_email') }}</span><input v-model.trim="email" type="email" autocomplete="email" required placeholder="you@restaurant.com" /></label>
        <label v-if="!isForgot"><span>{{ $t('auth_password') }}</span><input v-model="password" type="password" :autocomplete="isRegister ? 'new-password' : 'current-password'" minlength="8" required /></label>
        <p v-if="message" class="auth-message" :class="{ 'auth-message--error': isError }" role="status">{{ message }}</p>
        <button class="btn btn-primary auth-submit" type="submit" :disabled="loading">{{ loading ? $t('auth_working') : $t(isForgot ? 'auth_submit_forgot' : isRegister ? 'auth_submit_register' : 'auth_submit_signin') }}</button>
      </form>
      <p class="auth-switch">{{ $t(isForgot || isRegister ? 'auth_to_signin' : 'auth_to_register') }} <router-link :to="alternateRoute">{{ alternateLabel }}</router-link></p>
      <router-link v-if="!isRegister && !isForgot" class="auth-recovery" to="/forgot-password">{{ $t('auth_forgot_link') }}</router-link>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase } from '../supabase.js'
import { useStore } from '../stores/store.js'
import LanguagePicker from '../components/LanguagePicker.vue'
import { UI_LANGUAGES } from '../uiLanguages.js'

const route = useRoute()
const router = useRouter()
const store = useStore()
const { t } = useI18n()
const languageOptions = UI_LANGUAGES
const isRegister = computed(() => route.path === '/register')
const isForgot = computed(() => route.path === '/forgot-password')
const alternateRoute = computed(() => isRegister.value || isForgot.value ? '/login' : '/register')
const alternateLabel = computed(() => t(isRegister.value || isForgot.value ? 'nav_sign_in' : 'nav_create_account'))
const fullName = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const message = ref('')
const isError = ref(false)

const openWorkspace = async () => {
  // A fresh sign-in replaces whatever the tab had loaded, then goes through
  // the same bootstrap the router uses, so the two cannot drift apart.
  store.clearSession()
  await store.ensureSession()
  // Only a path on this origin. startsWith('/') alone is not that test:
  // '//evil.example' and '/\\evil.example' both pass it and are read as
  // protocol-relative URLs pointing somewhere else entirely.
  const requested = route.query.redirect
  const isInternalPath = typeof requested === 'string'
    && requested.startsWith('/')
    && !requested.startsWith('//')
    && !requested.startsWith('/\\')
  const redirect = isInternalPath ? requested : '/structures'
  await router.push(redirect)
}

const submit = async () => {
  loading.value = true
  message.value = ''
  isError.value = false
  try {
    if (isForgot.value) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
      message.value = t('auth_reset_sent')
      return
    }
    if (isRegister.value) {
      const { data, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: {
          data: { full_name: fullName.value },
          emailRedirectTo: `${window.location.origin}/login`
        }
      })
      if (error) throw error
      if (data.session && data.user) {
        await openWorkspace()
      } else {
        message.value = t('auth_check_inbox')
      }
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
    if (error) throw error
    await openWorkspace()
  } catch (error) {
    isError.value = true
    message.value = error.message || t('auth_generic_error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page { min-height: 100dvh; padding: var(--s-5); background: var(--c-bg); }.auth-nav { width: min(100%, 1120px); margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: var(--s-4); }.auth-nav__end { display: flex; align-items: center; gap: var(--s-4); }.auth-brand { color: var(--c-ink); font-size: 1.15rem; font-weight: 800; letter-spacing: .08em; }.auth-brand span { color: var(--c-brand); }.auth-nav__link { color: var(--c-ink-2); font-size: .9rem; font-weight: 700; }.auth-nav__link:hover { color: var(--c-brand); }.auth-card { width: min(100%, 440px); margin: clamp(72px, 14vh, 132px) auto 0; padding: var(--s-6); background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-md); }.auth-card__eyebrow { color: var(--c-brand); font-size: .75rem; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }.auth-card h1 { margin-top: var(--s-2); color: var(--c-ink); font-size: 1.6rem; line-height: 1.2; letter-spacing: -.02em; text-wrap: balance; }.auth-card > p { margin-top: var(--s-2); color: var(--c-ink-2); font-size: .93rem; line-height: 1.55; }.auth-form { display: grid; gap: var(--s-3); margin-top: var(--s-5); }.auth-form label { display: grid; gap: 6px; color: var(--c-ink-2); font-size: .84rem; font-weight: 700; }.auth-form input { min-height: 44px; width: 100%; padding: 0 var(--s-3); color: var(--c-ink); font: inherit; background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--r-sm); }.auth-form input:focus { border-color: var(--c-brand); outline: 2px solid var(--c-brand-soft); outline-offset: 0; }.auth-submit { width: 100%; margin-top: var(--s-2); }.auth-message { margin: 0; padding: var(--s-3); color: var(--c-success); font-size: .86rem; font-weight: 650; background: var(--c-success-soft); border-radius: var(--r-sm); }.auth-message--error { color: var(--c-danger); background: var(--c-danger-soft); border-radius: var(--r-sm); }.auth-switch { margin-top: var(--s-5) !important; text-align: center; }.auth-switch a, .auth-recovery { color: var(--c-brand); font-weight: 750; }.auth-switch a:hover, .auth-recovery:hover { text-decoration: underline; }.auth-recovery { display: block; margin-top: var(--s-3); font-size: .86rem; text-align: center; } @media (max-width: 520px) { .auth-page { padding: var(--s-4); }.auth-card { margin-top: var(--s-7); padding: var(--s-5); } }
</style>
