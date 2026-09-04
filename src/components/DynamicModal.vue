<template>
  <transition name="fade">
    <div v-if="open" class="vue-modal" @click.self="close">
      <transition name="drop-in">
        <div v-if="open" class="vue-modal-inner">
          <div class="vue-modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ modalLabel }}</h5>
              <button type="button" class="close" :aria-label="$t('close')" @click="close">
                <font-awesome-icon icon="fa-solid fa-xmark" />
              </button>
            </div>
            <div class="modal-body">
              <div v-for="block in modalData">
                <BaseInput v-if="block.type !== 'tabs' && block.type !== 'allergens' && block.type !== 'file'"
                           :label="fieldLabel(block.label)" :type="block.type" v-model="block.value" />
                <TabLanguages v-if="block.type === 'tabs'" :tabs-data="block.tabs" @add-price="addPrice"
                              @remove-price="removePrice" @toggle-main-tab-inputs="toggleMainTabInputs"
                              @add-description="addDescription" @remove-description="removeDescription" />
                <CheckboxAllergens v-if="block.type === 'allergens' && currentTab === store.selectedStructure.structure.language_main" :allergens="block.value"
                                   @update-allergens="updateAllergens" />
                <div v-if="block.type === 'file' && currentTab === store.selectedStructure.structure.language_main">
                  <BaseInput
                      v-if="!block.value"
                      :label="fieldLabel(block.label)"
                      :type="block.type"
                      :accept="ACCEPTED_IMAGE_TYPES"
                      :disabled="uploading"
                      @change="changeImage($event, block)" />
                  <div v-else>
                    <div class="flex align-center">
                      <img :src="mediaUrl(block.value)" alt="" class="picture-select">
                      <div class="custom-control custom-switch">
                        <label class="switch">
                          <input type="checkbox" :checked="block.active !== false"
                                 @change="block.active = $event.target.checked">
                          <span class="slider round"></span>
                        </label>
                        <span class="switch-caption">{{ $t(block.active === false ? 'photo_hidden' : 'photo_shown') }}</span>
                      </div>
                    </div>

                    <div>
                      <div class="eliminate-btn" @click="deletePicture(block)">
                        {{ $t('delete') }}
                      </div>
                    </div>
                  </div>
                  <p v-if="uploading" class="upload-note" role="status">{{ $t('uploading') }}</p>
                  <p v-if="uploadError" class="upload-error" role="alert">{{ $t(uploadError) }}</p>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn white-btn cancel-btn" @click="close">
                {{ $t('cancel') }}
              </button>
              <button type="button" class="btn green-btn save-btn" @click="save">
                {{ $t('save') }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup>
import { useStore } from '../stores/store.js'
import { useI18n } from 'vue-i18n'
import { translateFieldLabel } from '../descriptorFields.js'
import TabLanguages from './TabLanguages.vue'
import BaseInput from './BaseInput.vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import CheckboxAllergens from './CheckboxAllergens.vue'
import { onBeforeMount, ref } from 'vue'
import { ACCEPTED_IMAGE_TYPES, mediaUrl, uploadStructureImage } from '../media.js'

const store = useStore()
const { t } = useI18n()
const fieldLabel = (label) => translateFieldLabel(label, t)

const emits = defineEmits(['closeModal', 'addPrice', 'removePrice', 'removeDescription', 'addDescription'])
const props = defineProps({
  open: {
    type: Boolean,
    required: true
  },
  index: {
    type: Number,
    required: false
  },
  modalData: {
    required: false
  },
  modalLabel: {
    type: String,
    default: 'Aggiuni Lista'
  },
  action: {
    type: String,
    required: true
  },
  type: {
    type: String
  }
})

const uploading = ref(false)
const uploadError = ref('')
const currentTab = ref('')

onBeforeMount(() => {
  currentTab.value = store.selectedStructure.structure.language_main
})

const toggleMainTabInputs = (id) => {
  currentTab.value = id
}

/**
 * Uploads the picture and writes its path onto the descriptor block.
 *
 * This used to read the file into a local ref for the preview and stop there,
 * so the photo was never saved — the modal showed it, the database never got
 * it. It also went in as base64; it now goes to Storage like every other image.
 */
const changeImage = async (event, block) => {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return
  uploadError.value = ''
  uploading.value = true
  try {
    block.value = await uploadStructureImage(file, {
      userId: store.user.user_id,
      structureId: store.selectedStructure.structure_id,
      field: props.type === 'category' ? 'category' : 'dish'
    })
    if (block.active === undefined) block.active = true
  } catch (err) {
    uploadError.value = err.message
  } finally {
    uploading.value = false
    input.value = ''
  }
}

// The object is dropped once the record is saved, so abandoning the edit
// leaves the published menu pointing at an image that still exists.
const deletePicture = (block) => {
  if (block.value) store.pendingMediaRemovals.push(block.value)
  block.value = ''
  uploadError.value = ''
}
const updateAllergens = (id) => {
  const allergens = props.modalData.find(item => item.type === 'allergens')
  if (allergens) {
    if (allergens.value.includes(id)) {
      allergens.value.splice(allergens.value.indexOf(id), 1)
    } else {
      allergens.value.push(id)
    }
  }
}
const addPrice = () => {
  emits('addPrice', props.modalData)
}
const removePrice = (index) => {
  emits('removePrice', props.modalData, index)
}
const addDescription = () => {
  emits('addDescription', props.modalData)
}
const removeDescription = (index) => {
  emits('removeDescription', props.modalData, index)
}
const save = () => {
  emits('closeModal', props.modalData, props.index, props.action, props.type)
}
const close = () => {
  emits('closeModal', null, props.index, props.action)
}
</script>

<style scoped>
.switch-caption { margin-left: var(--s-2); color: var(--c-ink-2); font-size: .78rem; font-weight: 650; }
.upload-note { margin-top: var(--s-2); color: var(--c-ink-2); font-size: .82rem; }
.upload-error { margin-top: var(--s-2); color: var(--c-danger); font-size: .82rem; font-weight: 650; }
.align-center {
  align-items: center;
  width: 100%;
}

.custom-control {
  margin-left: 30px;
}

.drop-in-enter-active,
.drop-in-leave-active {
  transition: all 0.3s ease-out;
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

.eliminate-btn:hover {
  background-color: #d9d7cd;
  border-color: #d9d7cd;
  color: #333132;
}

.drop-in-enter-from,
.drop-in-leave-to {
  opacity: 0;
  transform: translate(0, -50px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

.svg-inline--fa {
  color: #000;
  height: 1rem !important;
}

*,
::before,
::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: proxima-nova, sans-serif;
}

.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  -webkit-transition: .4s;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  -webkit-transition: .4s;
  transition: .4s;
}

input:checked + .slider {
  background-color: #c5df94;
}

input:focus + .slider {
  box-shadow: 0 0 1px #c5df94;
}

input:checked + .slider:before {
  -ms-transform: translateX(26px);
  transform: translateX(26px);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

.picture-select {
  max-width: 60%;
  margin-bottom: 20px;
  height: auto;
}

.picture-select img {
  vertical-align: middle;
  border-style: none;
  overflow-clip-margin: content-box;
  overflow: clip;
}

/* Fixed rather than absolute so the dialog stays put on long pages, and
   scrollable so tall forms remain reachable on short screens. */
.vue-modal {
  position: fixed;
  inset: 0;
  width: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 998;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.vue-modal-inner {
  max-width: 800px;
  /* Side margin keeps the dialog off the screen edges on phones. */
  margin: 1rem;
}

@media (min-width: 832px) {
  .vue-modal-inner { margin: 2rem auto; }
}

.vue-modal-content {
  position: relative;
  display: -ms-flexbox;
  display: flex;
  -ms-flex-direction: column;
  flex-direction: column;
  width: 100%;
  pointer-events: auto;
  background-color: #fff;
  background-clip: padding-box;
  border: 1px solid rgba(0, 0, 0, .2);
  border-radius: 0.3rem;
  outline: 0;
}

.modal-header {
  padding: 1rem 1.5rem;
  background-color: #efeeea;
  border-bottom: 0;
  display: flex;
  justify-content: space-between;
  border-top-left-radius: calc(0.3rem - 1px);
  border-top-right-radius: calc(0.3rem - 1px);
}

h5 {
  margin-bottom: 0;
  line-height: 1.5;
  font-size: 1.25rem;
  font-weight: 500;
  margin-top: 0;
}

.close {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
  color: #000;
  opacity: .5;
  cursor: pointer;
}

.close:hover {
  opacity: 0.75;
}

.info-translate:hover + div {
  opacity: 1;
}

.modal-body {
  padding: 1rem 1.5rem;
  position: relative;
  -ms-flex: 1 1 auto;
  flex: 1 1 auto;
  margin-bottom: 1rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  justify-content: flex-end;
  border-top: 1px solid #dee2e6;
  border-bottom-right-radius: calc(0.3rem - 1px);
  border-bottom-left-radius: calc(0.3rem - 1px);
  display: flex;
}

.btn {
  display: inline-block;
  font-weight: 400;
  color: #212529;
  text-align: center;
  vertical-align: middle;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  background-color: transparent;
  border: 1px solid transparent;
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border-radius: 0.25rem;
  transition: color .15s ease-in-out, background-color .15s ease-in-out, border-color .15s ease-in-out, box-shadow .15s ease-in-out;
}

p {
  margin-bottom: 1rem;
}

.cancel-btn {
  background-color: #e6e5e1;
  border-color: #e6e5e1;
  color: #333132;
}

.cancel-btn:hover {
  background-color: #d9d7cd;
  border-color: #d9d7cd;
  color: #333132;
}

.save-btn {
  background-color: #c5df94;
  border-color: #c5df94;
  color: #fff;
}

.save-btn:hover {
  background-color: #bed78e;
  border-color: #bed78e;
}

.modal-footer > * {
  margin: 0.25rem;
}

/* Shared dialog vocabulary */
.vue-modal { z-index: var(--z-backdrop); padding: var(--s-3); background: rgba(19, 30, 23, 0.42); }
.vue-modal-inner { width: min(100%, 760px); max-width: none; margin: var(--s-5) auto; }
.vue-modal-content { border-color: var(--c-line); border-radius: var(--r-md); box-shadow: var(--shadow-lg); }
.modal-header { align-items: center; padding: var(--s-4) var(--s-5); background: var(--c-surface); border-bottom: 1px solid var(--c-line); border-radius: var(--r-md) var(--r-md) 0 0; }
.modal-title, h5 { font-size: 1.125rem; font-weight: 750; color: var(--c-ink); }
.close { width: 34px; height: 34px; display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--r-sm); background: transparent; color: var(--c-ink-3); }
.close:hover { background: var(--c-line-2); color: var(--c-ink); }
.modal-body { padding: var(--s-4) var(--s-5); margin-bottom: 0; }
.modal-footer { gap: var(--s-2); padding: var(--s-3) var(--s-5); border-color: var(--c-line); }
.modal-footer > * { margin: 0; }
.modal-footer .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 var(--s-4); border-radius: var(--r-sm); font: inherit; font-weight: 700; }
.modal-footer .cancel-btn { background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-ink); }
.modal-footer .cancel-btn:hover { background: var(--c-line-2); }
.modal-footer .save-btn { background: var(--c-brand); border: 1px solid var(--c-brand); color: #fff; }
.modal-footer .save-btn:hover { background: #253f36; border-color: #253f36; }

@media (max-width: 560px) {
  .vue-modal { padding: 0; }
  .vue-modal-inner { margin: 0; min-height: 100%; display: flex; align-items: flex-end; }
  .vue-modal-content { border-radius: var(--r-md) var(--r-md) 0 0; }
  .modal-header, .modal-body, .modal-footer { padding-left: var(--s-4); padding-right: var(--s-4); }
}
</style>
