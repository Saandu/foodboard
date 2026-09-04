<template>
  <main class="page" v-if="store.isStructureLoaded && store.selectedStructure">
    <section class="page-section settings-page">
      <div class="page-content">
        <aside class="aside settings-nav">
          <span class="settings-nav__title">{{ $t('settings') }}</span>
          <nav :aria-label="$t('settings')">
            <button v-for="section in sections" :key="section.id" type="button" class="settings-nav__item"
                    :class="{ 'is-active': selectedSection === section.id }"
                    :aria-current="selectedSection === section.id ? 'page' : undefined"
                    @click="selectedSection = section.id">
              {{ $t(section.labelKey) }}
            </button>
          </nav>
        </aside>

        <section class="main-content settings-panel">
          <div v-if="selectedSection === 'first'" class="settings-section">
            <div class="page-title"><h1>{{ $t('info_general') }}</h1><p>{{ $t('theme_text') }}</p></div>
            <TabLanguages v-if="structure.description?.tabs" :tabs-data="structure.description.tabs" @handle-tab-updates="updateDescription" />
          </div>

          <div v-if="selectedSection === 'second'" class="settings-section">
            <div class="page-title"><h1>{{ $t('colors_appearance') }}</h1><p>{{ $t('theme_text') }}</p></div>
            <div class="appearance-grid">
              <div class="appearance-fields">
                <section class="settings-group">
                  <h2>{{ $t('theme_and_color') }}</h2>
                  <p>{{ $t('primary_color') }}</p>
                  <div class="color-options" aria-label="Primary color">
                    <button type="button" class="color-swatch color-swatch--black" :class="{ 'is-selected': structure.color_main === '#000000' }" aria-label="Black" @click="structure.color_main = '#000000'" />
                    <button type="button" class="color-swatch color-swatch--white" :class="{ 'is-selected': structure.color_main === '#ffffff' }" aria-label="White" @click="structure.color_main = '#ffffff'" />
                    <label class="color-swatch color-swatch--custom" :class="{ 'is-selected': !['#000000', '#ffffff'].includes(structure.color_main) }" :style="{ backgroundColor: structure.color_main }" aria-label="Custom color">
                      <input v-model="selectedColor" type="color" @change="changeColor" />
                    </label>
                  </div>
                </section>

                <section class="settings-group">
                  <h2>{{ $t('logo') }}</h2>
                  <BaseInput v-if="!structure.logo" :accept="ACCEPTED_IMAGE_TYPES" :disabled="uploading === 'logo'" type="file" @change="changeImage($event, 'logo')" />
                  <div v-else class="media-row"><img :src="mediaUrl(structure.logo)" alt="Current logo" class="media-preview" /><button type="button" class="btn btn-text" @click="deletePicture('logo')">{{ $t('delete') }}</button></div>
                  <p v-if="uploading === 'logo'" class="field-help" role="status">{{ $t('uploading') }}</p>
                  <p v-if="uploadError.logo" class="save-error" role="alert">{{ $t(uploadError.logo) }}</p>
                  <p class="field-help">{{ $t('allowed_formats') }}</p>
                </section>


                <section class="settings-group">
                  <h2>{{ $t('desktop_bg_color') }}</h2>
                  <BaseInput id="colorBg" v-model="structure.color_background" is-color :label="$t('color')" type="color" />
                  <button type="button" class="btn btn-text" @click="store.resetBackgroundColor">{{ $t('reset_bg') }}</button>
                </section>

                <section class="settings-group">
                  <h2>{{ $t('theme') }}</h2>
                  <div class="theme-options">
                    <label v-for="option in ['light', 'dark']" :key="option" :class="{ 'is-selected': structure.color_theme === option }">
                      <input v-model="structure.color_theme" name="theme" type="radio" :value="option" />
                      <!-- Drawn rather than a screenshot, so it always reflects
                           the chosen brand colour and never goes stale. -->
                      <span class="theme-swatch" :class="`theme-swatch--${option}`" aria-hidden="true">
                        <span class="theme-swatch__bar" :style="{ background: structure.color_main }"></span>
                        <span class="theme-swatch__line theme-swatch__line--wide"></span>
                        <span class="theme-swatch__line"></span>
                        <span class="theme-swatch__line theme-swatch__line--short"></span>
                      </span>
                      <span>{{ $t(option === 'light' ? 'light_theme' : 'dark_theme') }}</span>
                    </label>
                  </div>
                </section>
              </div>
              <MenuPreview :color-main="structure.color_main" :theme="structure.color_theme" />
            </div>
          </div>

          <div v-if="selectedSection === 'third'" class="settings-section">
            <div class="page-title"><h1>{{ $t('contact_sections') }}</h1><p>{{ $t('contact_help') }}</p></div>
            <div class="settings-stack">
              <BaseInput v-model="structure.contact.address" :label="$t('address')" type="text" />
              <BaseInput v-model="structure.contact.phone" :label="$t('phone')" type="tel" />
              <BaseInput v-model="structure.contact.email" :label="$t('contact_email')" type="email" />
              <BaseInput v-model="structure.contact.website" :label="$t('website')" type="url" />
              <BaseInput v-model="structure.contact.instagram" :label="$t('instagram')" type="text" />
            </div>
          </div>

          <div v-if="selectedSection === 'fourth'" class="settings-section">
            <div class="page-title"><h1>{{ $t('international_options') }}</h1><p>{{ $t('theme_text') }}</p></div>
            <section class="settings-group"><h2>{{ $t('enabled_languages') }}</h2><CheckboxLanguages /></section>
            <div class="settings-stack">
              <SelectComponent v-model="structure.language_main" :all-options="store.allLanguages" :options="structure.languages" :selected="structure.language_main" :placeholder-option="$t('main_language')" :label="$t('main_language')" @update:selected="store.updateMainLanguage" />
              <SelectComponent v-model="structure.currency" :all-options="store.allCurrencies" :options="store.allCurrenciesOptions" :selected="structure.currency" :label="$t('menu_currency')" :placeholder-option="$t('currency')" @update:selected="store.updateMainCurrency" />
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-primary" :disabled="!store.isStructureSavable" @click="store.saveStructure()">{{ $t('save') }}</button>
            <span v-if="store.structureSaved" class="saved-hint" role="status">{{ $t('saved') }}</span>
            <span v-if="store.saveError" class="save-error" role="alert">{{ $t(store.saveError) }}</span>
            <button type="button" class="btn btn-quiet" @click="pushListsRoute">{{ $t('go_to_lists') }}</button>
          </div>
        </section>
      </div>
    </section>
  </main>
  <main v-else-if="store.isStructureLoaded" class="page"><section class="page-section"><section class="workspace-empty"><span>Your workspace is ready</span><h1>Create your first restaurant menu.</h1><p>Start with your restaurant details, then add lists, categories and dishes.</p><button type="button" class="btn btn-primary" :disabled="creating" @click="createFirstStructure">{{ creating ? 'Creating…' : 'Create my first menu' }}</button></section></section></main>
</template>

<script setup>
import { computed, onBeforeMount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from '../stores/store.js'
import BaseInput from '../components/BaseInput.vue'
import TabLanguages from '../components/TabLanguages.vue'
import CheckboxLanguages from '../components/CheckboxLanguages.vue'
import SelectComponent from '../components/SelectComponent.vue'
import MenuPreview from '../components/MenuPreview.vue'
import { ACCEPTED_IMAGE_TYPES, mediaUrl, uploadStructureImage } from '../media.js'

const store = useStore()
const router = useRouter()
const route = useRoute()
const structure = computed(() => store.selectedStructure.structure)
const selectedSection = ref('first')
const selectedColor = ref('#000000')
const creating = ref(false)
const uploading = ref('')
const uploadError = ref({ logo: '' })
const sections = [
  { id: 'first', labelKey: 'info_general' }, { id: 'second', labelKey: 'colors_appearance' },
  { id: 'third', labelKey: 'contact_sections' }, { id: 'fourth', labelKey: 'international_options' }
]

const changeColor = () => { structure.value.color_main = selectedColor.value }
const updateDescription = (tabsData) => {
  if (structure.value.description && Array.isArray(tabsData)) structure.value.description.tabs = tabsData
}
// Images go to Storage on select; the structure keeps only the object path, so
// the row stays small and the dashboard no longer downloads megabytes of base64.
const changeImage = async (event, field) => {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return
  uploadError.value[field] = ''
  uploading.value = field
  try {
    structure.value[field] = await uploadStructureImage(file, {
      userId: store.user.user_id,
      structureId: store.selectedStructure.structure_id,
      field
    })
  } catch (err) {
    uploadError.value[field] = err.message
  } finally {
    uploading.value = ''
    // Let the same file be chosen again after a rejected upload.
    input.value = ''
  }
}
// The object itself is dropped once the save lands, so abandoning the edit
// leaves the published menu pointing at an image that still exists.
const deletePicture = (field) => {
  if (structure.value[field]) store.pendingMediaRemovals.push(structure.value[field])
  structure.value[field] = ''
  uploadError.value[field] = ''
}
const pushListsRoute = () => router.push({ path: '/lists', query: { structure_id: store.selectedStructure.structure_id } })
const createFirstStructure = async () => {
  creating.value = true
  try {
    const created = await store.createStructure()
    await router.replace({ path: '/structures', query: { structure_id: created.structure_id } })
  } finally {
    creating.value = false
  }
}

onBeforeMount(async () => {
  if (!store.selectedStructure) return
  selectedColor.value = structure.value.color_main
  window.scrollTo(0, 0)
  const requested = route.query.structure_id
  const match = requested && store.structures.find(item => item.structure_id === requested)
  store.selectedStructure = match || store.structures[0]
  if (!match || !requested) await router.replace({ path: '/structures', query: { structure_id: store.selectedStructure.structure_id } })
})
</script>

<style scoped>
.settings-page { padding-top: var(--s-5); }.settings-nav { padding: var(--s-3); background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-md); }.settings-nav__title { display: block; margin: 0 var(--s-2) var(--s-2); color: var(--c-ink-3); font-size: .72rem; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }.settings-nav nav { display: grid; gap: 2px; }.settings-nav__item { min-height: 40px; padding: 0 var(--s-2); color: var(--c-ink-2); text-align: left; font: 650 .9rem/1.2 inherit; background: transparent; border: 0; border-radius: var(--r-sm); cursor: pointer; }.settings-nav__item:hover { color: var(--c-ink); background: var(--c-line-2); }.settings-nav__item.is-active { color: #fff; background: var(--c-brand); }.save-error { color: var(--c-danger); font-size: .85rem; font-weight: 650; }
.settings-panel { min-height: 620px; }.settings-section { max-width: 900px; }.page-title { margin-bottom: var(--s-6); padding-bottom: var(--s-4); border-bottom: 1px solid var(--c-line); }.page-title h1 { font-size: 1.55rem; }.page-title p { max-width: 62ch; margin-top: var(--s-2); font-size: .92rem; }.settings-group { margin-bottom: var(--s-6); }.settings-group h2 { margin-bottom: var(--s-2); font-size: 1rem; }.settings-group > p:not(.field-help) { margin-bottom: var(--s-3); font-size: .9rem; }.settings-stack { display: grid; gap: var(--s-2); }.appearance-grid { display: grid; gap: var(--s-6); align-items: start; }.appearance-fields { min-width: 0; }.color-options { display: flex; gap: var(--s-2); }.color-swatch { width: 40px; height: 40px; padding: 3px; border: 1px solid var(--c-line-strong); border-radius: 50%; cursor: pointer; }.color-swatch.is-selected { outline: 2px solid var(--c-brand); outline-offset: 2px; }.color-swatch--black { background: #101010; }.color-swatch--white { background: #fff; }.color-swatch--custom { overflow: hidden; display: block; position: relative; }.color-swatch--custom input { position: absolute; inset: -8px; width: calc(100% + 16px); height: calc(100% + 16px); padding: 0; opacity: 0; cursor: pointer; }.media-row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--s-3); }.media-preview { max-width: min(100%, 240px); max-height: 160px; object-fit: cover; border: 1px solid var(--c-line); border-radius: var(--r-sm); }.theme-options { display: flex; flex-wrap: wrap; gap: var(--s-3); }.theme-options label { position: relative; display: grid; gap: var(--s-2); width: 148px; padding: var(--s-2); color: var(--c-ink-2); font-size: .85rem; font-weight: 650; border: 1px solid var(--c-line); border-radius: var(--r-sm); cursor: pointer; }.theme-options label.is-selected { color: var(--c-ink); border-color: var(--c-brand); background: var(--c-brand-soft); }.theme-options input { position: absolute; opacity: 0; }.theme-swatch { display: grid; align-content: start; gap: 5px; height: 78px; padding: 8px; border-radius: 3px; }.theme-swatch__bar { height: 10px; border-radius: 2px; }.theme-swatch__line { height: 6px; border-radius: 2px; background: currentColor; opacity: .25; }.theme-swatch__line--wide { width: 100%; }.theme-swatch__line--short { width: 55%; }.theme-swatch--light { color: #101010; background: #fff; box-shadow: inset 0 0 0 1px var(--c-line); }.theme-swatch--dark { color: #fff; background: #1c1d1f; }
@media (min-width: 1024px) { .appearance-grid { grid-template-columns: minmax(0, 1fr) 300px; } }
@media (max-width: 1023px) { .settings-nav { display: flex; align-items: center; gap: var(--s-2); overflow-x: auto; }.settings-nav__title { flex: 0 0 auto; margin: 0; }.settings-nav nav { display: flex; flex: 0 0 auto; }.settings-nav__item { white-space: nowrap; } }
@media (max-width: 600px) { .settings-page { padding-top: var(--s-4); }.settings-panel { padding: var(--s-4); }.page-title { margin-bottom: var(--s-5); }.form-actions .btn { flex: 1 1 auto; } }
.workspace-empty { width: min(100%, 620px); margin: var(--s-8) auto; padding: var(--s-7); text-align: center; background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-md); }.workspace-empty span { color: var(--c-brand); font-size: .75rem; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }.workspace-empty h1 { margin-top: var(--s-3); font-size: 1.8rem; line-height: 1.15; text-wrap: balance; }.workspace-empty p { margin: var(--s-3) auto var(--s-5); max-width: 48ch; color: var(--c-ink-2); line-height: 1.55; }
</style>
