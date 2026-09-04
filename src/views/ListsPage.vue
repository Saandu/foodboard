<template>
  <div class="page">
    <SendFeedbackModal
        :open="openFeedbackModal"
        @close-feedback="closeFeedbackModal"
    />

    <section v-if="store.isListLoaded" class="page-section">
<div class="page-content">
        <aside class="aside workspace-sidebar">
          <button type="button" class="btn btn-quiet back-link" @click="backToStructures">
              <font-awesome-icon icon="fa-solid fa-angle-left" />
              <span>{{ $t('menu_options') }}</span>
          </button>
          <div class="sidebar-group">
            <h2>{{ $t('status') }}</h2>
            <div class="segmented-filter" :aria-label="$t('status')">
              <button v-for="option in statusOptions" :key="option.value" type="button" class="filter-chip"
                      :aria-pressed="statusFilter === option.value" @click="statusFilter = option.value">
                {{ $t(option.label) }}
              </button>
            </div>
            <h2>{{ $t('feedback') }}</h2>
            <button type="button" @click="openFeedbackModal = true" class="feedback-link">{{ $t('send_feedback_prompt') }}</button>
          </div>
        </aside>

        <div class="main-content">
          <div class="page-toolbar">
            <div><h1>{{ $t('lists') }}</h1><p>{{ $t('list_name') }}</p></div>
            <button type="button" class="btn btn-primary" @click="addList(-1)">{{ $t('add_list') }}</button>
          </div>
          <div class="list-table">
            <p v-if="store.saveError" class="save-error" role="alert">{{ $t(store.saveError) }}</p>
            <ListShortData v-for="(list , index) in store.lists.lists" :key="list.list_id"
                           @enter-list="enterList(list.list_id)"
                           @toggle-active="toggleActive(list, $event)"
                           :name="list.name" :count="list.count" :category="list.category"
                           :active="list.active" :index="index" :display="isListVisible(list) ? 'block' : 'none'"
                           @edit-list="editList(index, list.list_id)"
                           @duplicate-list="duplicateList(index)" @delete-list="deleteList(index)" />

            <DynamicModal
                :open="openModal"
                :modal-label="$t('add_list')"
                @close-modal="closeModal"
                :modal-data="modalData"
                :index="listIndex"
                :action="action"
            />
            <button type="button" class="empty-action"
                 :style="store.lists.lists.length === 0 ? {display: 'flex'} : {display: 'none'}"
                 @click="addList(-1)">
              <span>{{ $t('create_first_list') }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onBeforeMount, ref } from 'vue'
import { useStore } from '../stores/store.js'
import { useRoute, useRouter } from 'vue-router'
import ListShortData from '../components/ListShortData.vue'
import SendFeedbackModal from '../components/SendFeedbackModal.vue'
import DynamicModal from '../components/DynamicModal.vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useI18n } from 'vue-i18n'
import { clone } from '../clone.js'

const store = useStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const openFeedbackModal = ref(false)

const statusFilter = ref('all')
const statusOptions = [
  { value: 'all', label: 'all' },
  { value: 'published', label: 'published' },
  { value: 'draft', label: 'drafts' }
]
const isListVisible = (list) => statusFilter.value === 'all' ||
  (statusFilter.value === 'published' ? list.active : !list.active)

const openModal = ref(false)
const modalData = ref({})
const listIndex = ref(-1)
const action = ref('add')
const currentList_id = ref('')


onBeforeMount(async () => {
  window.scrollTo(0, 0)
  const requested = route.query.structure_id
  const selected = store.structures.find(structure => structure.structure_id === requested) || store.selectedStructure || store.structures[0]
  if (!selected) return
  store.selectedStructure = selected
  await store.requestLists(selected.structure_id)
  if (requested !== selected.structure_id) await router.replace({ path: '/lists', query: { structure_id: selected.structure_id } })
})

const backToStructures = async () => {
  await router.push({
    path: '/structures',
    query: { structure_id: store.selectedStructure.structure_id }
  })
}
const enterList = async (list_id) => {
  await store.requestCategories(list_id)
  await router.push({
    path: '/categories',
    query: { structure_id: store.selectedStructure.structure_id, list_id: store.list_id }
  })

}
const addList = (index) => {
  window.scrollTo(0, 0)
  listIndex.value = index
  currentList_id.value = '-1'
  action.value = 'add'
  modalData.value = clone(store.lists.addModal)
  openModal.value = true
}
const editList = (index, list_id) => {
  window.scrollTo(0, 0)
  listIndex.value = index
  currentList_id.value = list_id
  action.value = 'edit'
  modalData.value = clone(store.lists.lists[index].editModal)
  openModal.value = true
}
const duplicateList = async (index) => {
  const copy = await store.duplicateList(store.lists.lists[index], store.selectedStructure.structure_id)
  store.lists.lists.splice(index + 1, 0, copy)
}
const deleteList = async (index) => {
  const list = store.lists.lists[index]
  if (!window.confirm(`${t('delete')} “${list.name}”?`)) return
  await store.deleteList(list.list_id)
  store.lists.lists.splice(index, 1)
}
const closeModal = async (data, index, action) => {
  if (data !== null) {
    if (action === 'add') {
      let name
      for (let i = 0; i < data[0].tabs.length; i++) {
        if (data[0].tabs[i][0].tabLabel === store.selectedStructure.structure.language_main) {
          name = data[0].tabs[i][1].value
        }
      }
      // The primary key column is `list_id`; a new list needs its own id or the
      // upsert has nothing to key on and the list is silently dropped.
      const newList = {
        list_id: store.createId(),
        name: name,
        count: 0,
        category: 0,
        active: false,
        editModal: data
      }
      const insertAt = index === -1 ? store.lists.lists.length : index + 1
      store.lists.lists.splice(insertAt, 0, newList)
    }
    if (action === 'edit') {
      store.lists.lists[index].editModal = data
      for (let i = 0; i < data[0].tabs.length; i++) {
        if (data[0].tabs[i][0].tabLabel === store.selectedStructure.structure.language_main) {
          store.lists.lists[index].name = data[0].tabs[i][1].value
        }
      }
    }
    await store.saveLists(store.selectedStructure.structure_id)
  }
  openModal.value = false
}
const toggleActive = async (list, active) => {
  // Persist the new value, rather than the stale value that existed before
  // Vue assigned the inline event expression.
  list.active = active
  await store.saveLists(store.selectedStructure.structure_id)
}
const closeFeedbackModal = () => {
  openFeedbackModal.value = !openFeedbackModal.value
}
</script>

<style scoped>
input[type="checkbox"]:checked {
  accent-color: #E6E5E1;
}

input[type="checkbox"] {
  width: 15px;
  height: 15px;
  cursor: pointer;
}

input[type="checkbox"]:hover {
  box-shadow: 0 0 0 0.2rem rgb(197 223 148 / 35%);
  border-color: #c5df94;
  accent-color: #d9d9d9;
  outline: 0;
}

.workspace-sidebar { display: grid; align-content: start; gap: var(--s-4); }.back-link { justify-content: flex-start; width: fit-content; }.sidebar-group { display: grid; gap: var(--s-2); padding: var(--s-4) 0; border-top: 1px solid var(--c-line); }.sidebar-group h2 { color: var(--c-ink-3); font-size: .75rem; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }.feedback-link { padding: 0; color: var(--c-ink-2); text-align: left; font: 600 .85rem/1.4 inherit; background: transparent; border: 0; cursor: pointer; }.feedback-link:hover { color: var(--c-brand); text-decoration: underline; }

.stato-checkboxes label, .stato-checkboxes input {
  cursor: pointer;
  color: #7f7f7f;
}

.stato-checkboxes input {
  margin-right: 5px;
}

.stato-checkboxes div {
  margin: 5px 0 0 0;
  display: flex;
  align-items: center;
}

.page-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-4); padding-bottom: var(--s-5); border-bottom: 1px solid var(--c-line); }.page-toolbar h1 { font-size: 1.55rem; }.page-toolbar p { margin-top: var(--s-1); font-size: .875rem; }.list-table { margin-top: var(--s-1); }
@media (max-width: 600px) { .page-toolbar { flex-direction: column; }.page-toolbar .btn { width: 100%; } }
</style>
