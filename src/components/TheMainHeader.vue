<template>
  <header v-if="store.isHeaderLoaded" class="app-header">
    <div class="container app-header__inner">
      <button type="button" class="wordmark" @click="backToStructures" aria-label="FoodBoard home">FOOD<span>BOARD</span></button>
      <div class="app-header__tools">
        <LanguagePicker :model-value="$i18n.locale" :options="languageOptions" :label="$t('language')" inverse @update:model-value="$i18n.locale = $event" />
        <details class="account-menu">
          <summary :aria-label="$t('account_link')">{{ store.user.name?.slice(0, 1) || 'A' }}</summary>
          <div class="account-menu__content">
            <strong>{{ store.user.name }} {{ store.user.surname }}</strong><span>{{ $t('greeting') }}</span>
            <button type="button" @click="backToStructures">{{ $t('profile_link') }}</button>
            <button type="button" class="account-menu__logout" @click="handleLogout">{{ $t('logout') }}</button>
            <button type="button" class="account-menu__delete" @click="openDeleteAccount">{{ $t('delete_account') }}</button>
          </div>
        </details>
      </div>
    </div>
  </header>
  <DeleteAccountModal :open="deleteAccountOpen" @close="deleteAccountOpen = false" />
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../stores/store.js'
import { supabase } from '../supabase.js'
import LanguagePicker from './LanguagePicker.vue'
import DeleteAccountModal from './DeleteAccountModal.vue'
import { UI_LANGUAGES } from '../uiLanguages.js'
const store = useStore()
const router = useRouter()
const languageOptions = UI_LANGUAGES
const deleteAccountOpen = ref(false)
// Close the dropdown first, or it stays open behind the modal.
const openDeleteAccount = (event) => {
  event.target.closest('details')?.removeAttribute('open')
  deleteAccountOpen.value = true
}
const backToStructures = () => router.push({ path: '/structures', query: { structure_id: store.selectedStructure?.structure_id } })
// Clear the loaded workspace too, or the next account to sign in on this tab
// inherits the previous one's structures.
const handleLogout = async () => {
  await supabase.auth.signOut()
  store.clearSession()
  await router.push('/login')
}
</script>

<style scoped>
.app-header { position: sticky; top: 0; z-index: var(--z-sticky); min-height: var(--header-h); background: var(--c-ink); color: #fff; }
.app-header__inner { min-height: var(--header-h); display: flex; align-items: center; justify-content: space-between; gap: var(--s-4); }
.wordmark { padding: 0; color: #fff; font: 800 1rem/1 'Figtree', sans-serif; letter-spacing: .055em; background: transparent; border: 0; cursor: pointer; }.wordmark span { color: var(--c-accent); }
.app-header__tools { display: flex; align-items: center; gap: var(--s-2); }
.account-menu { position: relative; }.account-menu summary { display: grid; place-items: center; width: 34px; height: 34px; list-style: none; color: var(--c-ink); font: 750 .85rem/1 inherit; background: var(--c-accent); border-radius: 50%; cursor: pointer; }.account-menu summary::-webkit-details-marker { display: none; }
.account-menu__content { position: absolute; top: calc(100% + var(--s-2)); right: 0; z-index: var(--z-dropdown); display: grid; min-width: 210px; gap: var(--s-1); padding: var(--s-3); color: var(--c-ink); background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--r-md); box-shadow: var(--shadow-sm); }.account-menu__content strong { font-size: .9rem; }.account-menu__content span { margin-bottom: var(--s-2); color: var(--c-ink-3); font-size: .78rem; }.account-menu__content button { min-height: 36px; padding: 0 var(--s-2); color: var(--c-ink-2); text-align: left; font: 600 .85rem/1 inherit; background: transparent; border: 0; border-radius: var(--r-sm); cursor: pointer; }.account-menu__content button:hover { color: var(--c-ink); background: var(--c-line-2); }.account-menu__content .account-menu__logout { color: var(--c-danger); }.account-menu__content .account-menu__delete { margin-top: var(--s-1); padding-top: var(--s-2); color: var(--c-ink-3); font-size: .78rem; border-top: 1px solid var(--c-line); border-radius: 0; }.account-menu__content .account-menu__delete:hover { color: var(--c-danger); background: transparent; }
</style>
