<template>
  <div v-if="open" class="modal-backdrop" @click.self="close" @keydown.esc="close">
    <section class="delete-dialog" role="dialog" aria-modal="true" :aria-label="$t('delete_account')">
      <header class="delete-dialog__header">
        <div>
          <span class="delete-dialog__eyebrow">{{ $t('danger_zone') }}</span>
          <h2>{{ $t('delete_account') }}</h2>
          <p>{{ $t('delete_account_warning') }}</p>
        </div>
        <button type="button" class="icon-btn" :aria-label="$t('close')" :disabled="deleting" @click="close">
          <font-awesome-icon icon="fa-solid fa-xmark" />
        </button>
      </header>

      <div class="delete-dialog__body">
        <ul class="delete-list">
          <li>{{ $t('delete_account_item_menus') }}</li>
          <li>{{ $t('delete_account_item_images') }}</li>
          <li>{{ $t('delete_account_item_links') }}</li>
        </ul>

        <label class="delete-confirm">
          <span>{{ $t('delete_account_confirm_label', { email }) }}</span>
          <input v-model="typed" type="email" autocomplete="off" spellcheck="false" :disabled="deleting" />
        </label>

        <p v-if="failed" class="delete-error" role="alert">{{ $t('delete_account_failed') }}</p>
      </div>

      <footer class="dialog-actions">
        <button type="button" class="btn btn-quiet" :disabled="deleting" @click="close">{{ $t('cancel') }}</button>
        <button type="button" class="btn btn-danger" :disabled="!canDelete" @click="confirmDelete">
          {{ deleting ? $t('deleting') : $t('delete_account') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useStore } from '../stores/store.js'
import { supabase } from '../supabase.js'

const emits = defineEmits(['close'])
const props = defineProps({ open: { type: Boolean, required: true } })
const store = useStore()
const router = useRouter()

const email = ref('')
const typed = ref('')
const deleting = ref(false)
const failed = ref(false)

// Typing the account's own address is the confirmation: it cannot be produced
// by a stray click, and unlike a fixed word it does not need translating.
const canDelete = computed(() =>
  !deleting.value && email.value !== '' && typed.value.trim().toLowerCase() === email.value.toLowerCase())

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  typed.value = ''
  failed.value = false
  const { data } = await supabase.auth.getUser()
  email.value = data?.user?.email || ''
})

const close = () => { if (!deleting.value) emits('close') }

const confirmDelete = async () => {
  deleting.value = true
  failed.value = false
  try {
    await store.deleteAccount()
    await router.push('/')
  } catch (err) {
    console.error('Could not delete the account:', err)
    failed.value = true
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; z-index: var(--z-modal); display: grid; place-items: center; padding: var(--s-4); overflow-y: auto; background: rgba(12, 24, 18, .68); }
.delete-dialog { width: min(100%, 560px); margin: auto; overflow: hidden; color: var(--c-ink); background: var(--c-surface); border-radius: var(--r-lg); box-shadow: var(--shadow-lg); }
.delete-dialog__header { display: flex; justify-content: space-between; gap: var(--s-5); padding: var(--s-5) var(--s-5) var(--s-4); border-bottom: 1px solid var(--c-line); }.delete-dialog__header > div { min-width: 0; }.delete-dialog__eyebrow { display: block; color: var(--c-danger); font-size: .72rem; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }.delete-dialog h2 { margin-top: var(--s-1); font-size: 1.4rem; line-height: 1.2; letter-spacing: -.02em; }.delete-dialog__header p { max-width: 52ch; margin-top: var(--s-2); color: var(--c-ink-2); font-size: .9rem; line-height: 1.5; text-wrap: pretty; }
.delete-dialog__body { display: grid; gap: var(--s-4); padding: var(--s-5); }
.delete-list { display: grid; gap: var(--s-2); margin: 0; padding-left: var(--s-5); color: var(--c-ink-2); font-size: .88rem; line-height: 1.5; }
.delete-confirm { display: grid; gap: var(--s-2); }.delete-confirm > span { color: var(--c-ink-3); font-size: .78rem; font-weight: 700; }.delete-confirm input { width: 100%; min-height: 42px; padding: 9px 12px; color: var(--c-ink); font: 400 .95rem/1.5 inherit; background: var(--c-surface); border: 1px solid #cbd2cc; border-radius: var(--r-sm); }.delete-confirm input:focus { border-color: var(--c-danger); box-shadow: 0 0 0 3px rgba(190, 60, 60, .13); outline: 0; }
.delete-error { margin: 0; color: var(--c-danger); font-size: .85rem; font-weight: 650; }
.dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: var(--s-2); padding: var(--s-4) var(--s-5); background: var(--c-line-2); border-top: 1px solid var(--c-line); }
.btn-danger { color: #fff; background: var(--c-danger); border-color: var(--c-danger); }.btn-danger:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 520px) { .modal-backdrop { padding: var(--s-2); align-items: end; }.delete-dialog__header, .delete-dialog__body { padding: var(--s-4); }.dialog-actions .btn { flex: 1 1 auto; } }
</style>
