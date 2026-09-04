<template>
  <main class="auth-page">
    <nav class="auth-nav">
      <router-link to="/" class="auth-brand">FOOD<span>BOARD</span></router-link>
      <div class="auth-nav__end">
        <LanguagePicker :model-value="$i18n.locale" :options="languageOptions" :label="$t('language')" @update:model-value="$i18n.locale = $event" />
        <router-link class="auth-nav__link" to="/login">{{ $t('nav_sign_in') }}</router-link>
      </div>
    </nav>
    <section class="auth-card">
      <span class="auth-card__eyebrow">{{ $t('login_badge') }}</span>
      <h1>{{ $t('reset_title') }}</h1>
      <p>{{ $t('reset_lede') }}</p>
      <form class="auth-form" @submit.prevent="submit">
        <label><span>{{ $t('reset_new_password') }}</span><input v-model="password" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters" /></label>
        <label><span>{{ $t('reset_confirm_password') }}</span><input v-model="confirmation" type="password" autocomplete="new-password" minlength="8" required placeholder="Repeat your password" /></label>
        <p v-if="message" class="auth-message" :class="{ 'auth-message--error': isError }" role="status">{{ message }}</p>
        <button class="btn btn-primary auth-submit" type="submit" :disabled="loading || !recoveryReady">{{ loading ? $t('auth_working') : $t('reset_submit') }}</button>
      </form>
      <router-link class="auth-recovery" to="/forgot-password">{{ $t('reset_request_new') }}</router-link>
    </section>
  </main>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguagePicker from '../components/LanguagePicker.vue'
import { UI_LANGUAGES } from '../uiLanguages.js'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase.js'

const router = useRouter()
const { t } = useI18n()
const languageOptions = UI_LANGUAGES
const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const recoveryReady = ref(false)
const message = ref('')
const isError = ref(false)
let authSubscription

const setRecoveryState = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  recoveryReady.value = Boolean(session)
  if (!recoveryReady.value) {
    isError.value = true
    message.value = t('reset_invalid')
  }
}

onMounted(async () => {
  authSubscription = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryReady.value = true
      message.value = ''
      isError.value = false
    }
  }).data.subscription
  await setRecoveryState()
})

onUnmounted(() => authSubscription?.unsubscribe())

const submit = async () => {
  if (password.value !== confirmation.value) {
    isError.value = true
    message.value = t('reset_mismatch')
    return
  }
  loading.value = true
  message.value = ''
  isError.value = false
  try {
    const { error } = await supabase.auth.updateUser({ password: password.value })
    if (error) throw error
    message.value = t('reset_done')
    window.setTimeout(() => router.push('/structures'), 900)
  } catch (error) {
    isError.value = true
    message.value = error.message || t('reset_error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page { min-height: 100dvh; padding: var(--s-5); background: var(--c-bg); }.auth-nav { width: min(100%, 1120px); margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: var(--s-4); }.auth-nav__end { display: flex; align-items: center; gap: var(--s-4); }.auth-brand { color: var(--c-ink); font-size: 1.15rem; font-weight: 800; letter-spacing: .08em; }.auth-brand span { color: var(--c-brand); }.auth-nav__link { color: var(--c-ink-2); font-size: .9rem; font-weight: 700; }.auth-nav__link:hover { color: var(--c-brand); }.auth-card { width: min(100%, 440px); margin: clamp(72px, 14vh, 132px) auto 0; padding: var(--s-6); background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-md); }.auth-card__eyebrow { color: var(--c-brand); font-size: .75rem; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }.auth-card h1 { margin-top: var(--s-2); color: var(--c-ink); font-size: 1.6rem; line-height: 1.2; letter-spacing: -.02em; }.auth-card > p { margin-top: var(--s-2); color: var(--c-ink-2); font-size: .93rem; line-height: 1.55; }.auth-form { display: grid; gap: var(--s-3); margin-top: var(--s-5); }.auth-form label { display: grid; gap: 6px; color: var(--c-ink-2); font-size: .84rem; font-weight: 700; }.auth-form input { min-height: 44px; width: 100%; padding: 0 var(--s-3); color: var(--c-ink); font: inherit; background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--r-sm); }.auth-form input:focus { border-color: var(--c-brand); outline: 2px solid var(--c-brand-soft); outline-offset: 0; }.auth-submit { width: 100%; margin-top: var(--s-2); }.auth-message { margin: 0; padding: var(--s-3); color: var(--c-success); font-size: .86rem; font-weight: 650; background: var(--c-success-soft); border-radius: var(--r-sm); }.auth-message--error { color: var(--c-danger); background: var(--c-danger-soft); }.auth-recovery { display: block; margin-top: var(--s-5); color: var(--c-brand); font-size: .86rem; font-weight: 750; text-align: center; }.auth-recovery:hover { text-decoration: underline; } @media (max-width: 520px) { .auth-page { padding: var(--s-4); }.auth-card { margin-top: var(--s-7); padding: var(--s-5); } }
</style>
