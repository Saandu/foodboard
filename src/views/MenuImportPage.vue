<template>
  <section class="page-section import-page">
    <div class="import-heading">
      <RouterLink class="btn btn-quiet" :to="backLink">← {{ $t('menu_import.back') }}</RouterLink>
      <h1>{{ $t('menu_import.title') }}</h1>
      <p>{{ $t('menu_import.intro') }}</p>
    </div>
    <p v-if="!structure" role="alert">{{ $t('menu_import.no_structure') }}</p>
    <template v-else>
      <ol class="import-steps" :aria-label="$t('menu_import.steps')">
        <li :aria-current="!draft ? 'step' : undefined">1. {{ $t('menu_import.upload') }}</li>
        <li :aria-current="draft ? 'step' : undefined">2. {{ $t('menu_import.review') }}</li>
        <li>3. {{ $t('menu_import.save_draft') }}</li>
      </ol>
      <p v-if="demo" class="import-notice">{{ $t('menu_import.demo_notice') }}</p>
      <p v-if="error" class="import-error" role="alert">{{ error }}</p>
      <div v-if="!draft" class="upload-section">
        <h2>{{ $t('menu_import.choose') }}</h2>
        <p>{{ $t('menu_import.limits') }}</p>
        <label class="upload-picker">
          <span>{{ $t('menu_import.file') }}</span>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" :disabled="busy || demo" @change="selectFile">
        </label>
        <p v-if="file">{{ file.name }} · {{ (file.size / 1024 / 1024).toFixed(1) }} MB</p>
        <label class="check-line"><input v-model="consent" type="checkbox" :disabled="busy || demo"> {{ $t('menu_import.consent') }}</label>
        <p class="import-muted">{{ $t('menu_import.privacy') }}</p>
        <div class="import-actions">
          <button type="button" class="btn btn-primary" :disabled="!file || !consent || busy || demo" @click="extract">{{ busy ? $t('menu_import.extracting') : $t('menu_import.extract') }}</button>
          <button type="button" class="btn btn-quiet" :disabled="busy" @click="loadSample">{{ $t('menu_import.sample') }}</button>
        </div>
        <p v-if="busy" role="status" aria-live="polite">{{ $t('menu_import.wait') }}</p>
      </div>
      <div v-else class="review-layout" :aria-busy="busy">
        <aside class="source-panel">
          <h2>{{ $t('menu_import.source') }}</h2>
          <img v-if="previewUrl && file?.type.startsWith('image/')" :src="previewUrl" :alt="$t('menu_import.source')">
          <a v-else-if="previewUrl" :href="previewUrl" target="_blank" rel="noopener">{{ $t('menu_import.view_pdf') }}</a>
          <p v-else>{{ $t('menu_import.sample_source') }}</p>
          <p>{{ file?.name }}</p>
          <p>{{ $t('menu_import.review_help') }}</p>
          <p>{{ $t('menu_import.restaurant_currency', { currency: structure.structure.currency }) }}</p>
          <button type="button" class="btn btn-quiet" :disabled="busy || saveAttempted" @click="restart">{{ $t('menu_import.restart') }}</button>
        </aside>
        <form class="review-form" @submit.prevent="save">
          <fieldset :disabled="busy || saveAttempted">
            <legend>{{ $t('menu_import.review') }} · {{ itemCount }} {{ $t('menu_import.dishes') }}</legend>
            <div class="draft-fields">
              <label>{{ $t('menu_import.menu_name') }}<input v-model="draft.title" maxlength="120" required></label>
              <label>{{ $t('menu_import.language') }}<select v-model="draft.language"><option v-for="language in store.allLanguages" :key="language.id" :value="language.id">{{ language.name }}</option></select></label>
              <label>{{ $t('menu_import.currency') }}<input v-model="draft.currency" maxlength="10" placeholder="EUR"></label>
            </div>
            <p v-if="!currencyOkay" class="import-error" role="alert">{{ $t('menu_import.currency_mismatch') }}</p>
            <p v-if="!draft.currency" class="import-notice">{{ $t('menu_import.currency_unknown') }}</p>
            <ul v-if="draft.warnings.length" class="import-notice"><li v-for="(warning, index) in draft.warnings" :key="index">{{ warning }}</li></ul>
            <section v-for="(category, categoryIndex) in draft.categories" :key="categoryIndex" class="review-category">
              <div class="category-heading">
                <label>{{ $t('menu_import.category') }}<input v-model="category.name" maxlength="120" required></label>
                <button type="button" class="btn btn-quiet" @click="draft.categories.splice(categoryIndex, 1)">{{ $t('menu_import.remove_category') }}</button>
              </div>
              <label>{{ $t('menu_import.description') }}<textarea v-model="category.description" maxlength="1000" rows="2"></textarea></label>
              <article v-for="(item, itemIndex) in category.items" :key="itemIndex" class="review-item">
                <div class="item-heading"><h3>{{ itemIndex + 1 }}. {{ item.name || $t('menu_import.dish') }}</h3><button type="button" class="btn btn-quiet" @click="removeItem(categoryIndex, itemIndex)">{{ $t('menu_import.remove_dish') }}</button></div>
                <label>{{ $t('menu_import.dish') }}<input v-model="item.name" maxlength="120" required></label>
                <label>{{ $t('menu_import.description') }}<textarea v-model="item.description" maxlength="1000" rows="2"></textarea></label>
                <div v-for="(price, priceIndex) in item.prices" :key="priceIndex" class="price-row">
                  <label>{{ $t('menu_import.price') }}<input v-model="price.amount" inputmode="decimal" pattern="[0-9]{1,6}(\.[0-9]{1,2})?" maxlength="12" required placeholder="12.50"></label>
                  <label>{{ $t('menu_import.portion') }}<input v-model="price.label" maxlength="80"></label>
                  <button v-if="item.prices.length > 1" type="button" class="btn btn-quiet" :aria-label="$t('menu_import.remove_price')" @click="item.prices.splice(priceIndex, 1)">×</button>
                </div>
                <button v-if="item.prices.length < 6" type="button" class="btn btn-quiet" @click="item.prices.push({ amount: '', label: '' })">{{ $t('menu_import.add_price') }}</button>
                <details><summary>{{ $t('menu_import.allergens') }} ({{ item.allergens.length }})</summary><p>{{ $t('menu_import.allergen_help') }}</p><div class="allergen-options"><label v-for="allergen in store.allAllergens" :key="allergen.id"><input v-model="item.allergens" type="checkbox" :value="Number(allergen.id)"> {{ $t(allergen.key) }}</label></div></details>
                <p v-if="item.warning" class="import-notice">{{ item.warning }}</p>
              </article>
            </section>
            <p v-if="!itemCount" role="alert">{{ $t('menu_import.empty') }}</p>
            <label class="check-line"><input v-model="reviewed" type="checkbox"> {{ $t('menu_import.confirm_review') }}</label>
            <p>{{ $t('menu_import.unpublished') }}</p>
          </fieldset>
          <p v-if="saveAttempted && !busy" class="import-notice" role="status">{{ $t('menu_import.save_pending') }}</p>
          <button class="btn btn-primary" type="submit" :disabled="!canSave || demo">{{ busy ? $t('menu_import.saving') : $t(saveAttempted ? 'menu_import.retry_save' : 'menu_import.save_draft') }}</button>
        </form>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useStore } from '../stores/store.js'
import { importRequest } from '../api/menuImport.js'
import { isDemoUser } from '../demo.js'
import { currencyMatches, MAX_FILE_BYTES, MIME_TYPES, validateDraft } from '../../supabase/functions/_shared/menu-import.js'

const store = useStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const structure = computed(() => store.structures.find(entry => entry.structure_id === route.query.structure_id))
const backLink = computed(() => ({ path: '/lists', query: { structure_id: route.query.structure_id } }))
const demo = computed(() => isDemoUser(store.user.email))
const file = ref(null)
const previewUrl = ref('')
const consent = ref(false)
const draft = ref(null)
const reviewed = ref(false)
const busy = ref(false)
const error = ref('')
let importId = crypto.randomUUID()
let saved = false
const saveAttempted = ref(false)
const itemCount = computed(() => draft.value?.categories.reduce((count, category) => count + category.items.length, 0) || 0)
const currencyOkay = computed(() => currencyMatches(draft.value?.currency || '', structure.value?.structure.currency || ''))
const canSave = computed(() => reviewed.value && currencyOkay.value && itemCount.value && !busy.value)
watch(draft, () => { reviewed.value = false }, { deep: true })

function showError (failure) {
  const key = `menu_import.errors.${failure.message}`
  const message = t(key)
  error.value = message === key ? t('menu_import.errors.connection_error') : message
}
function selectFile (event) {
  error.value = ''
  file.value = null
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  const selected = event.target.files?.[0]
  if (!selected) return
  if (!MIME_TYPES.includes(selected.type)) return showError(new Error('unsupported_file'))
  if (selected.size > MAX_FILE_BYTES) return showError(new Error('file_too_large'))
  file.value = selected
  previewUrl.value = URL.createObjectURL(selected)
}
async function extract () {
  if (!file.value || !consent.value || !structure.value || busy.value || demo.value) return
  busy.value = true
  error.value = ''
  importId = crypto.randomUUID()
  try {
    const result = await importRequest('extract', structure.value.structure_id, importId, file.value)
    draft.value = validateDraft(result.draft)
  } catch (failure) { showError(failure) } finally { busy.value = false }
}
function loadSample () {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  file.value = null
  importId = crypto.randomUUID()
  draft.value = { title: t('menu_import.sample_title'), language: 'en', currency: structure.value.structure.currency, warnings: [], categories: [{ name: 'Main courses', description: '', items: [{ name: 'Garden pasta', description: 'Pasta, roasted tomatoes, basil', prices: [{ amount: '12.50', label: '' }], allergens: [6], warning: '' }, { name: 'Grilled vegetables', description: 'Seasonal vegetables with olive oil', prices: [{ amount: '9.00', label: 'Small' }, { amount: '14.00', label: 'Large' }], allergens: [], warning: '' }] }] }
  error.value = ''
}
function restart () {
  if (draft.value && !window.confirm(t('menu_import.discard'))) return
  draft.value = null
  reviewed.value = false
  error.value = ''
  saveAttempted.value = false
}
function removeItem (categoryIndex, itemIndex) {
  const category = draft.value.categories[categoryIndex]
  category.items.splice(itemIndex, 1)
  if (!category.items.length) draft.value.categories.splice(categoryIndex, 1)
}
async function save () {
  if (!canSave.value || demo.value) return
  error.value = ''
  let checked
  try { checked = validateDraft(draft.value) } catch (failure) { showError(failure); return }
  if (checked.categories.some(category => category.items.some(item => item.prices.some(price => !price.amount)))) return showError(new Error('invalid_prices'))
  busy.value = true
  saveAttempted.value = true
  try {
    const result = await importRequest('save', structure.value.structure_id, importId, JSON.stringify(checked))
    saved = true
    store.selectedStructure = structure.value
    await store.requestLists(structure.value.structure_id, true)
    store.list_id = result.list_id
    await router.push(backLink.value)
  } catch (failure) { showError(failure) } finally { busy.value = false }
}
// Do not accidentally discard an extraction or navigate during a pending save.
onBeforeRouteLeave(() => saved || ((!busy.value && !draft.value && !saveAttempted.value) || window.confirm(t('menu_import.discard'))))
const beforeUnload = event => { if (!saved && (draft.value || busy.value)) { event.preventDefault(); event.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => { window.removeEventListener('beforeunload', beforeUnload); if (previewUrl.value) URL.revokeObjectURL(previewUrl.value) })
</script>

<style scoped>
.import-page { max-width: 1200px; margin: auto; padding: var(--s-6); }
.import-heading { max-width: 70ch; margin-bottom: var(--s-6); }
.import-heading h1 { margin: var(--s-4) 0 var(--s-2); }
.import-heading p, .import-muted { color: var(--c-ink-2); }
.import-steps { display: flex; gap: var(--s-6); padding: 0 0 var(--s-4); list-style: none; border-bottom: 1px solid var(--c-line); }
.import-steps [aria-current] { font-weight: 700; }
.upload-section { max-width: 700px; padding: var(--s-6) 0; }
.upload-picker { display: grid; gap: var(--s-3); border: 1px dashed var(--c-line); padding: var(--s-6); margin: var(--s-4) 0; }
.import-actions, .category-heading, .item-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); }
.import-actions { justify-content: flex-start; flex-wrap: wrap; margin-top: var(--s-5); }
.check-line { display: flex; align-items: flex-start; gap: var(--s-2); margin: var(--s-4) 0; }
.check-line input, .allergen-options input { width: auto; flex-shrink: 0; margin-top: .25em; }
.review-layout { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(0, 2fr); gap: var(--s-6); margin-top: var(--s-6); }
.source-panel { align-self: start; position: sticky; top: var(--s-5); overflow-wrap: anywhere; }
.source-panel img { width: 100%; max-height: 60vh; object-fit: contain; background: white; border: 1px solid var(--c-line); }
.review-form fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.review-form legend { font-size: 1.25rem; font-weight: 700; margin-bottom: var(--s-4); }
.review-form label { display: grid; gap: var(--s-2); font-weight: 500; }
.review-form .check-line { display: flex; }
.draft-fields { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: var(--s-3); }
input:not([type='checkbox']), select, textarea { width: 100%; min-width: 0; padding: .65rem .75rem; border: 1px solid var(--c-line); border-radius: 6px; color: var(--c-ink); background: var(--c-surface, white); font: inherit; }
textarea { resize: vertical; }
.review-category { border-top: 1px solid var(--c-line); margin-top: var(--s-6); padding-top: var(--s-5); }
.category-heading { margin-bottom: var(--s-3); }
.category-heading label { flex: 1; }
.review-item { padding: var(--s-5) 0; border-bottom: 1px solid var(--c-line); display: grid; gap: var(--s-3); }
.item-heading h3 { margin: 0; font-size: 1rem; overflow-wrap: anywhere; }
.price-row { display: flex; gap: var(--s-3); align-items: end; }
.price-row label { flex: 1; min-width: 0; }
.allergen-options { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); }
.allergen-options label { display: flex; align-items: start; font-weight: 400; }
summary { cursor: pointer; padding: .5rem 0; }
.import-notice, .import-error { padding: var(--s-4); border: 1px solid var(--c-line); border-radius: 6px; margin: var(--s-4) 0; }
ul.import-notice { padding-left: var(--s-6); }
.import-error { color: #a02020; background: #fff5f5; }
@media (max-width: 760px) {
  .import-page { padding: var(--s-4); }
  .review-layout { grid-template-columns: 1fr; }
  .source-panel { position: static; }
  .source-panel img { max-height: 240px; }
  .draft-fields { grid-template-columns: 1fr; }
  .import-steps { gap: var(--s-3); font-size: .875rem; }
  .category-heading, .item-heading { align-items: start; flex-wrap: wrap; }
}
</style>
