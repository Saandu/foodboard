<template>
  <div v-if="open" class="modal-backdrop" @click.self="close">
    <section class="qr-dialog" role="dialog" aria-modal="true" tabindex="-1" :aria-label="$t('qr_heading')">
      <header class="qr-dialog__header">
        <div>
          <span class="qr-dialog__eyebrow">{{ $t('qr_heading') }}</span>
          <h2>{{ store.selectedStructure?.title || $t('menu') }}</h2>
          <p>{{ $t('qr_info') }}</p>
        </div>
        <button type="button" class="icon-btn" :aria-label="$t('close')" @click="close">
          <font-awesome-icon icon="fa-solid fa-xmark" />
        </button>
      </header>

      <div class="qr-dialog__body">
        <div class="qr-stage" :class="{ 'qr-stage--unavailable': !qrDataUrl }">
          <img v-if="qrDataUrl" :src="qrDataUrl" :alt="$t('qr_code_alt', { name: store.selectedStructure?.title || $t('menu') })" />
          <font-awesome-icon v-else icon="fa-solid fa-qrcode" aria-hidden="true" />
          <span>{{ $t(qrDataUrl ? 'qr_scan_hint' : 'qr_unavailable') }}</span>
        </div>

        <div class="qr-share">
          <div class="qr-share__meta">
            <span class="qr-share__label">{{ $t('qr_live_label') }}</span>
            <span class="qr-share__status"><i></i>{{ $t('published') }}</span>
          </div>
          <label class="qr-link">
            <span>{{ $t('qr_title') }}</span>
            <div class="qr-link__field">
              <input ref="linkInput" :value="qrLink" readonly type="text" @focus="$event.target.select()" />
              <button type="button" class="icon-btn" :aria-label="$t('qr_copy')" @click="copyURL">
                <font-awesome-icon :icon="copied ? 'fa-solid fa-check' : 'fa-solid fa-copy'" />
              </button>
            </div>
          </label>
          <p v-if="copied" class="copy-confirmation" role="status">{{ $t('qr_copied') }}</p>

          <div class="qr-rotate">
            <template v-if="!confirmingRotate">
              <button type="button" class="btn btn-text" :disabled="rotating || !qrLink" @click="confirmingRotate = true">{{ $t('qr_rotate') }}</button>
              <p class="field-help">{{ $t('qr_rotate_hint') }}</p>
            </template>
            <template v-else>
              <p class="qr-rotate__warning" role="alert">{{ $t('qr_rotate_confirm') }}</p>
              <div class="qr-rotate__actions">
                <button type="button" class="btn btn-text" :disabled="rotating" @click="confirmingRotate = false">{{ $t('cancel') }}</button>
                <button type="button" class="btn btn-quiet" :disabled="rotating" @click="rotateLink">{{ $t('qr_rotate') }}</button>
              </div>
            </template>
            <p v-if="rotated" class="copy-confirmation" role="status">{{ $t('qr_rotated') }}</p>
            <p v-if="rotateError" class="save-error" role="alert">{{ $t('qr_rotate_failed') }}</p>
          </div>
        </div>
      </div>

      <footer class="dialog-actions">
        <button type="button" class="btn btn-quiet" @click="downloadQR">
          <font-awesome-icon icon="fa-solid fa-download" aria-hidden="true" />
          {{ $t('download_qr') }}
        </button>
        <button type="button" class="btn btn-primary" @click="previewMenu">
          {{ $t('preview') }}
          <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useStore } from '../stores/store.js'

const emits = defineEmits(['close'])
const props = defineProps({ open: { type: Boolean, required: true } })
const store = useStore()
const copied = ref(false)
const linkInput = ref(null)
const qrDataUrl = ref('')
const confirmingRotate = ref(false)
const rotating = ref(false)
const rotated = ref(false)
const rotateError = ref(false)

// QR codes must remain usable after printing or sharing, including when this
// dashboard happens to be opened from a local Vite server.
const publicMenuOrigin = (import.meta.env.VITE_PUBLIC_MENU_ORIGIN || 'https://foodboard-demo.web.app').replace(/\/$/, '')
// The published address is the rotatable slug, not the structure's primary key.
const qrLink = computed(() => store.selectedStructure?.public_slug
  ? `${publicMenuOrigin}/menu/${store.selectedStructure.public_slug}`
  : '')

// Drawn locally: the share flow no longer depends on a third-party image API,
// and the download needs no network round trip. The encoder is imported on
// demand so it stays out of the dashboard's entry bundle.
const renderQr = async () => {
  if (!qrLink.value) {
    qrDataUrl.value = ''
    return
  }
  try {
    const { default: QRCode } = await import('qrcode')
    qrDataUrl.value = await QRCode.toDataURL(qrLink.value, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#16201c', light: '#ffffff' }
    })
  } catch (err) {
    console.error('Could not draw the QR code:', err)
    qrDataUrl.value = ''
  }
}

watch([() => props.open, qrLink], ([isOpen]) => {
  if (!isOpen) return
  copied.value = false
  confirmingRotate.value = false
  rotateError.value = false
  renderQr()
}, { immediate: true })

const close = () => emits('close')

/**
 * Escape closes the dialog.
 *
 * This was bound to the backdrop with `@keydown.esc`, which never fired: the
 * backdrop is a div with no tabindex, so it is not in the focus order and
 * receives no key events until something inside it is focused. A window
 * listener is what the photo lightbox already does.
 */
const onKeydown = (event) => {
  if (event.key === 'Escape' && props.open) close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const copyURL = async () => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(qrLink.value)
    } else {
      linkInput.value?.select()
      document.execCommand('copy')
    }
    copied.value = true
    window.setTimeout(() => { copied.value = false }, 2200)
  } catch {
    linkInput.value?.select()
  }
}

const downloadQR = () => {
  if (!qrDataUrl.value) return
  const link = document.createElement('a')
  link.href = qrDataUrl.value
  link.download = `FoodBoard-${(store.selectedStructure?.title || 'menu').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '')}-QR.png`
  link.click()
}

// Rotating retires the previous link: printed codes stop resolving, which is
// the point when one has leaked.
const rotateLink = async () => {
  rotating.value = true
  rotateError.value = false
  rotated.value = false
  try {
    await store.rotatePublicSlug(store.selectedStructure.structure_id)
    confirmingRotate.value = false
    rotated.value = true
    window.setTimeout(() => { rotated.value = false }, 3200)
  } catch (err) {
    console.error('Could not rotate the menu link:', err)
    rotateError.value = true
  } finally {
    rotating.value = false
  }
}

const previewMenu = () => {
  if (qrLink.value) window.open(qrLink.value, '_blank', 'noopener')
}
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; z-index: var(--z-modal); display: grid; place-items: center; padding: var(--s-4); overflow-y: auto; background: rgba(12, 24, 18, .68); }
.qr-dialog { width: min(100%, 760px); margin: auto; overflow: hidden; color: var(--c-ink); background: var(--c-surface); border-radius: var(--r-lg); box-shadow: var(--shadow-lg); }
.qr-dialog__header { display: flex; justify-content: space-between; gap: var(--s-5); padding: var(--s-5) var(--s-5) var(--s-4); border-bottom: 1px solid var(--c-line); }.qr-dialog__header > div { min-width: 0; }.qr-dialog__eyebrow, .qr-share__label, .qr-link > span { display: block; color: var(--c-ink-3); font-size: .72rem; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }.qr-dialog h2 { margin-top: var(--s-1); font-size: 1.5rem; line-height: 1.2; letter-spacing: -.02em; text-wrap: balance; }.qr-dialog__header p { max-width: 58ch; margin-top: var(--s-2); color: var(--c-ink-2); font-size: .9rem; line-height: 1.5; text-wrap: pretty; }
.qr-dialog__body { display: grid; gap: var(--s-5); padding: var(--s-5); }.qr-stage { display: grid; place-items: center; align-content: center; min-height: 272px; padding: var(--s-4); text-align: center; background: var(--c-line-2); border: 1px solid var(--c-line); border-radius: var(--r-md); }.qr-stage img { display: block; width: min(100%, 232px); aspect-ratio: 1; image-rendering: pixelated; }.qr-stage span { display: block; margin-top: var(--s-3); color: var(--c-ink-2); font-size: .78rem; font-weight: 650; }.qr-stage--unavailable svg { width: 58px; height: 58px; color: var(--c-ink-3); }
.qr-share { display: grid; align-content: center; gap: var(--s-4); min-width: 0; }.qr-share__meta { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); }.qr-share__status { display: inline-flex; align-items: center; gap: 6px; color: var(--c-success); font-size: .78rem; font-weight: 700; }.qr-share__status i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }.qr-link { display: grid; gap: var(--s-2); min-width: 0; }.qr-link__field { display: flex; align-items: center; min-width: 0; padding-left: var(--s-3); background: var(--c-line-2); border: 1px solid var(--c-line); border-radius: var(--r-sm); }.qr-link__field:focus-within { border-color: var(--c-brand); box-shadow: 0 0 0 2px var(--c-brand-soft); }.qr-link input { width: 100%; min-width: 0; height: 42px; padding: 0; overflow: hidden; color: var(--c-ink); font: 600 .84rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; white-space: nowrap; background: transparent; border: 0; outline: 0; }.qr-link .icon-btn { flex: 0 0 auto; margin-right: var(--s-1); }.copy-confirmation { margin: calc(var(--s-3) * -1) 0 0; color: var(--c-success); font-size: .82rem; font-weight: 650; }
.qr-rotate { display: grid; justify-items: start; gap: var(--s-2); margin-top: var(--s-1); padding-top: var(--s-4); border-top: 1px solid var(--c-line); }.qr-rotate .btn-text { margin-left: calc(var(--s-3) * -1); }.qr-rotate .field-help { margin-top: 0; font-size: .82rem; }.qr-rotate__warning { margin: 0; max-width: 46ch; color: var(--c-ink); font-size: .85rem; font-weight: 650; line-height: 1.5; }.qr-rotate__actions { display: flex; gap: var(--s-2); }.qr-rotate .save-error { color: var(--c-danger); font-size: .82rem; font-weight: 650; }
.dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: var(--s-2); padding: var(--s-4) var(--s-5); background: var(--c-line-2); border-top: 1px solid var(--c-line); }.dialog-actions .btn { flex: 0 1 auto; }
@media (min-width: 640px) { .qr-dialog__body { grid-template-columns: 272px minmax(0, 1fr); align-items: stretch; }.qr-stage { min-height: 280px; }.qr-share { padding-right: var(--s-2); } }
@media (max-width: 520px) { .modal-backdrop { padding: var(--s-2); align-items: end; }.qr-dialog { border-radius: var(--r-md); }.qr-dialog__header, .qr-dialog__body { padding: var(--s-4); }.qr-dialog__header { gap: var(--s-3); }.qr-dialog h2 { font-size: 1.25rem; }.qr-stage { min-height: 236px; }.qr-stage img { width: 196px; }.dialog-actions { padding: var(--s-3) var(--s-4); }.dialog-actions .btn { flex: 1 1 auto; } }
</style>
