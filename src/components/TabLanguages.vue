<template>
  <div class="tab-languages">
  <div class="input-field">
    <div v-for="tab in editableTabs">
      <div v-if="tab[0].tabLabel === selectedTabId">
        <div v-for="input in tab">
          <BaseInput
              v-if="!input.tabLabel && input.type !== 'file' && input.type !== 'prices' && input.type !== 'description_rows'"
              v-model="input.value"
              :label="fieldLabel(input.label)"
              :type="input.type" @input="updateTabsData" />


          <div v-if="input.type === 'file'">
            <BaseInput
                v-if="!input.value && !input.tabLabel && tab[0].tabLabel === store.selectedStructure.structure.language_main && input.type !== 'description_rows'"
                :label="fieldLabel(input.label)"
                :type="input.type"
                :accept="ACCEPTED_IMAGE_TYPES"
                :disabled="uploading"
                @change="changeImage($event)" />
            <div v-if="input.value">
              <img :src="mediaUrl(input.value)" alt="" class="picture-select">
              <div>
                <div class="eliminate-btn" @click="deletePicture()">
                  {{ $t('delete') }}
                </div>
              </div>
            </div>
            <p v-if="uploading" class="upload-note" role="status">{{ $t('uploading') }}</p>
            <p v-if="uploadError" class="upload-error" role="alert">{{ $t(uploadError) }}</p>
          </div>


          <div v-if="input.type === 'prices'">
            <div class="prices">
              <div class="div">
                <p class="input-label">{{ $t('price') }}</p>
                <div v-for="price in input.value">
                  <div class="flex align-center">
                    <div class="currency-label">{{ store.selectedStructure.structure.currency }}</div>
                    <BaseInput :disabled="tab[0].tabLabel !== store.selectedStructure.structure.language_main"
                               :class="tab[0].tabLabel !== store.selectedStructure.structure.language_main ? 'disabled-input' : ''"
                               :label="$t('price')" type="text" v-model="price.value" @input="updateAllTabsPrice" />
                  </div>
                </div>
              </div>
              <div class="div">
                <p class="input-label">{{ $t('suffix_optional') }}</p>
                <div v-for="(price, index) in input.value">
                  <div class="flex align-center">
                    <BaseInput :label="$t('price')" type="text" v-model="price.suffix" />
                    <p v-if="index !== 0 && tab[0].tabLabel === store.selectedStructure.structure.language_main"
                       class="red" @click="removePrice(index)">
{{ $t('delete') }}
</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex justify-end">
              <p v-if="tab[0].tabLabel === store.selectedStructure.structure.language_main" class="add-price"
                 @click="addPrice">
{{ $t('add_btn') }}
</p>
            </div>
          </div>

          <div v-if="input.type === 'description_rows'">
            <div class="div">
              <p class="input-label">{{ $t('short_description') }}</p>
              <div v-for="(description, index) in input.value">
                <div class="">
                  <BaseInput type="text" v-model="description.value" />
                  <p v-if="index !== 0 && tab[0].tabLabel === store.selectedStructure.structure.language_main"
                     class="red" @click="removeDescription(index)">
{{ $t('delete') }}
</p>
                </div>
              </div>
            </div>
            <div class="flex justify-end">
              <p v-if="tab[0].tabLabel === store.selectedStructure.structure.language_main" class="add-price"
                 @click="addDescription">
{{ $t('add_btn') }}
</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="tabs">
    <div class="align-end">
      <div class="tab-nav">
        <button type="button"
            v-for="(tab, index) in enabledTabs"
            :key="tab.id"
            :class="[{'selected': selectedTabId === tab.id}, {'tab-nav-main': tab.id === store.selectedStructure.structure.language_main}]"
            :title="languageName(tab.id)"
            @click="changeTab(tab.id, index)"
            class="tab-nav-item"
        >
{{ tab.id.toUpperCase() }}
</button>
      </div>
      <div class="translate-theme-switch">
        <button type="button" v-if="selectedTabId !== store.selectedStructure.structure.language_main" @click="getMainLangTabData()"
              class="btn btn-quiet translate-btn">
{{ $t('copy_from') }} {{
            store.selectedStructure.structure.language_main.toUpperCase()
          }}
</button>
      </div>
    </div>
  </div>
  </div>
</template>

<script setup>
import { computed, onBeforeMount, ref, watch } from 'vue'
import { useStore } from '../stores/store.js'
import BaseInput from './BaseInput.vue'
import { useI18n } from 'vue-i18n'
import { translateFieldLabel } from '../descriptorFields.js'
import { ACCEPTED_IMAGE_TYPES, mediaUrl, uploadStructureImage } from '../media.js'
import { clone } from '../clone.js'

const store = useStore()
const { t } = useI18n()
const fieldLabel = (label) => translateFieldLabel(label, t)

const emits = defineEmits(['handleTabUpdates', 'addPrice', 'removePrice', 'addDescription', 'removeDescription', 'toggleMainTabInputs'])
const props = defineProps({
  tabsData: {
    required: true
  }
})

const selectedTabId = ref(store.selectedStructure.structure.language_main)
const editableTabs = ref([])
const uploading = ref(false)
const uploadError = ref('')
let langIndex = 0

/** Only the languages this structure publishes in are worth editing. */
const enabledTabs = computed(() => store.tabs.filter(tab => !tab.disabled))

const languageName = (id) =>
  store.allLanguages.find(lang => lang.id === id)?.name || id.toUpperCase()

/**
 * Records saved before a language was enabled have no tab for it, which would
 * leave that language permanently uneditable. Build the missing tabs by cloning
 * the main language's field layout with the text values cleared, so every
 * enabled language always has a form to fill in.
 */
const withTabsForEnabledLanguages = (tabs) => {
  if (!tabs?.length) return tabs || []

  const mainLang = store.selectedStructure.structure.language_main
  const template = tabs.find(tab => tab[0]?.tabLabel === mainLang) || tabs[0]
  const result = [...tabs]

  for (const { id } of enabledTabs.value) {
    if (result.some(tab => tab[0]?.tabLabel === id)) continue

    const blank = clone(template)
    blank[0] = { tabLabel: id }

    for (const field of blank.slice(1)) {
      if (field.type === 'description_rows') {
        field.value = field.value.map(row => ({ ...row, value: '' }))
      } else if (field.type === 'prices') {
        // Prices are shared across languages; only the suffix is translated.
        field.value = field.value.map(price => ({ ...price, suffix: '' }))
      } else if (typeof field.value === 'string') {
        field.value = ''
      }
    }
    result.push(blank)
  }
  return result
}

onBeforeMount(() => {
  if (props.tabsData) {
    editableTabs.value = withTabsForEnabledLanguages([...props.tabsData])
  }
  store.rearrangeTabs()
})
watch(() => props.tabsData, (newVal) => {
  if (newVal) {
    editableTabs.value = withTabsForEnabledLanguages([...newVal])
    store.rearrangeTabs()
  }
})

const getMainLangTabData = () => {
  const languageMainTab = editableTabs.value.find(tab => tab[0].tabLabel === store.selectedStructure.structure.language_main)
  if (languageMainTab) {
    for (let i = 1; i < editableTabs.value[langIndex].length; i++) {
      if (editableTabs.value[langIndex][i].value === '')
        editableTabs.value[langIndex][i].value = languageMainTab[i].value
    }
  }
  if (languageMainTab) {
    if (editableTabs.value[langIndex][0].tabLabel !== languageMainTab[0].tabLabel) {
      editableTabs.value[langIndex].forEach(tab => {
        if (tab.type === 'prices') {
          tab.value.forEach((item, index) => {
            if (item.suffix === '') {
              item.suffix = languageMainTab.find(item => item.type === 'prices').value[index].suffix
            }
          })
        }
      })
      editableTabs.value[langIndex].forEach(tab => {
        if (tab.type === 'description_rows') {
          tab.value.forEach((item, index) => {
            if (item.value === '') {
              item.value = languageMainTab.find(item => item.type === 'description_rows').value[index].value
            }
          })
        }
      })
    }
  }
}
const updateAllTabsPrice = () => {
  const languageMainTab = editableTabs.value.find(tab => tab[0].tabLabel === store.selectedStructure.structure.language_main)

  editableTabs.value.forEach(price => {
    if (price[0].tabLabel !== languageMainTab[0].tabLabel) {
      price.forEach(tab => {
        if (tab.type === 'prices') {
          tab.value.forEach((item, index) => {
            item.value = languageMainTab.find(tab => tab.type === 'prices').value[index].value
          })
        }
      })
    }
  })

}

const changeTab = (id, index) => {
  langIndex = index
  selectedTabId.value = id
  emits('toggleMainTabInputs', id)
}
const updateTabsData = () => {
  // Persist plain data rather than Vue's ref wrapper.
  emits('handleTabUpdates', editableTabs.value)
}
const removePrice = (index) => {
  emits('removePrice', index)
}
const addPrice = () => {
  emits('addPrice')
}
const removeDescription = (index) => {
  emits('removeDescription', index)
}
const addDescription = () => {
  emits('addDescription')
}
/** The picture is one per record, mirrored onto every language tab. */
const eachFileField = (apply) => {
  for (const tab of editableTabs.value) {
    for (const field of tab) {
      if (field.type === 'file') apply(field)
    }
  }
}

const currentPicture = () => {
  let found = ''
  eachFileField(field => { if (!found && field.value) found = field.value })
  return found
}

// Uploaded to Storage rather than inlined as base64, so the categories row
// stays small however large the picture is.
const changeImage = async (event) => {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return
  uploadError.value = ''
  uploading.value = true
  try {
    const path = await uploadStructureImage(file, {
      userId: store.user.user_id,
      structureId: store.selectedStructure.structure_id,
      field: 'category'
    })
    eachFileField(field => { field.value = path })
    updateTabsData()
  } catch (err) {
    uploadError.value = err.message
  } finally {
    uploading.value = false
    input.value = ''
  }
}

// Removal waits for the save, so an abandoned edit leaves the menu intact.
const deletePicture = () => {
  const current = currentPicture()
  if (current) store.pendingMediaRemovals.push(current)
  eachFileField(field => { field.value = '' })
  uploadError.value = ''
  updateTabsData()
}
</script>

<style scoped>
.upload-note { margin-top: var(--s-2); color: var(--c-ink-2); font-size: .82rem; }
.upload-error { margin-top: var(--s-2); color: var(--c-danger); font-size: .82rem; font-weight: 650; }

.tab-languages { display: flex; flex-direction: column; gap: var(--s-4); }
.tabs { order: -1; display: flex; align-items: center; justify-content: flex-start; padding-bottom: var(--s-3); border-bottom: 1px solid var(--c-line); }

.align-end {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
}

.tab-nav {
  margin: 0;
  padding: 0;
  display: flex;
  width: auto;
  color: var(--c-ink-3);
  gap: var(--s-1);
}

.tab-nav-item {
  min-height: 36px;
  font: 700 .8rem/1 inherit;
  text-align: center;
  padding: 0 var(--s-3);
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  min-width: 36px;
  cursor: pointer;
  transition: background-color .18s ease, color .18s ease;
}

.tab-nav-item:hover { color: var(--c-ink); background: var(--c-line-2); }


.tab-nav-main { color: var(--c-brand); }


.selected { color: #fff; background-color: var(--c-brand); }

.tab-nav-error {
  color: #000000;
  border: 1px solid red;
  background-color: #fff;
}

.disabled {
  opacity: 0.4;
}

.align-center {
  align-items: center;
  width: 100%;
}

.currency-label {
  border-radius: 5px;
  padding: 8px 15px;
  margin-bottom: 10px;
  margin-top: 1px;
  margin-right: 10px;
  background-color: #d7d7d7;
}

.red {
  color: #b91919;
  text-align: right;
  margin-left: 40px;
}

.disabled-input input {
  background-color: black;
}

.red:hover {
  color: #ff0000;
  cursor: pointer;
}

.justify-end {
  justify-content: flex-end;
}

.add-price {
  text-align: right;
  transition: .2s all ease;
}

.add-price:hover {
  text-decoration: underline;
  cursor: pointer;
  color: #3b3b3b;
  transition: .2s all ease;

}

.eliminate-btn {
  margin-top: 20px;
  background-color: #e6e5e1;
  border-color: #e6e5e1;
  color: #333132;
  cursor: pointer;
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border-radius: 0.25rem;
  transition: color .15s ease-in-out, background-color .15s ease-in-out, border-color .15s ease-in-out, box-shadow .15s ease-in-out;
  display: inline-block;
  font-weight: 400;
  text-align: center;
  vertical-align: middle;
}

.input-label {
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.eliminate-btn:hover {
  background-color: #d9d7cd;
  border-color: #d9d7cd;
  color: #333132;
}

.prices {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
}

.prices .div {
  width: 80%;
}

.picture-select {
  max-width: 50%;
  height: auto;
}

.picture-select img {
  vertical-align: middle;
  border-style: none;
  overflow-clip-margin: content-box;
  overflow: clip;
}

.input-field {
  margin-top: 20px;
}

.translate-theme-switch {
  min-width: 100px;
  padding-left: 20px;
}

.translate-icon-container {
  min-width: 20px;
  display: flex;
  align-items: center;
}

.btn-wrapper {
  margin-bottom: 60px;
}

.translate-btn {
  padding-left: 20px;
  padding-right: 20px;
}

.info-translate {
  position: absolute;
  margin: 20px 0 0 5px;
  cursor: pointer;
}

.info-container {
  opacity: 0;
  background-color: #fff;
  transform: translateX(260px);
  position: absolute;
  padding: 5px;
  border-radius: 5px;
  margin: -45px 0 0 100px;
  width: 203px;
  text-align: center;
  font-size: 15px;
  box-shadow: 0 0 5px rgba(46, 46, 46, 0.69);
  transition: .3s linear;
}

.info-translate:hover + div {
  opacity: 1;
}
</style>
