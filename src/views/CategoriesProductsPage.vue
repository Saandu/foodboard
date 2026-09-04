<template>
  <div class="page">
    <SendFeedbackModal
        :open="openFeedbackModal"
        @close-feedback="closeFeedbackModal"
    />

    <section v-if="store.isProductLoaded" class="page-section">
<div class="page-content">
<aside class="aside workspace-sidebar">
          <button type="button" class="btn btn-quiet back-link" @click="pushListsRoute">
              <font-awesome-icon icon="fa-solid fa-chevron-left" />
              <span> {{ $t('back_to_lists') }}</span>
          </button>
          <div class="sidebar-group">
            <h2>{{ $t('sections') }}</h2>
            <div class="section-filter-list">
              <button type="button" class="section-filter" :class="{ 'is-active': tuttiCategory }" @click="toggleTuttiCategory">{{ $t('all') }}</button>
              <button v-for="category in store.categories.categories" :key="category.category_id" type="button" class="section-filter" :class="{ 'is-active': filteredCategories.includes(category.name) }" @click="toggleCategory(category.name)">{{ category.name }}</button>
            </div>
          </div>

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
            <div><h1>{{ $t('sections') }}</h1><p>{{ $t('product_name') }}</p></div>
            <button type="button" class="btn btn-primary" @click="addCategory(-1)">{{ $t('add_category') }}</button>
          </div>
          <div class="categories">
            <p v-if="store.saveError" class="save-error" role="alert">{{ $t(store.saveError) }}</p>
            <div v-for="(category, index) in store.categories.categories" :key="category.category_id">
              <div v-if="reRender">
                <CategoryData v-if="tuttiCategory || filteredCategories.includes(category.name)"
                              :active="category.active"
                              :name="category.name" :category_id="category.category_id" :index="index"
                              :display="isCategoryVisible(category) ? 'block' : 'none'"
                              @toggle-active="toggleActive(category, $event)"
                              @edit-category="editCategory(index)"
                              @move-category="moveCategory"
                              @duplicate-category="duplicateCategory"
                              @delete-category="deleteCategory" />
              </div>
            </div>
            <DynamicModal
                :open="openModal"
                :modal-label="currentModalLabel"
                @close-modal="closeModal"
                :modal-data="modalData"
                :index="categoryIndex"
                :action="action"
            />
          </div>
          <button v-if="store.categories.categories.length === 0" type="button" class="empty-action" @click="addCategory(-1)">{{ $t('add_section_prompt') }}</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { nextTick, onBeforeMount, ref } from 'vue'
import { useStore } from '../stores/store.js'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import CategoryData from '../components/CategoryData.vue'
import SendFeedbackModal from '../components/SendFeedbackModal.vue'
import DynamicModal from '../components/DynamicModal.vue'
import { clone } from '../clone.js'

const store = useStore()
const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const currentModalLabel = ref(t('add_category'))
const openModal = ref(false)
const modalData = ref({})
const categoryIndex = ref(-1)
const action = ref('add')
const filteredCategories = ref([])
const reRender = ref(true)

const openFeedbackModal = ref(false)
const tuttiCategory = ref(true)
const statusFilter = ref('all')
const statusOptions = [
  { value: 'all', label: 'all' },
  { value: 'published', label: 'published' },
  { value: 'draft', label: 'drafts' }
]
const isCategoryVisible = (category) => statusFilter.value === 'all' ||
  (statusFilter.value === 'published' ? category.active : !category.active)

onBeforeMount(async () => {
  window.scrollTo(0, 0)
  const requestedStructure = route.query.structure_id
  const selected = store.structures.find(structure => structure.structure_id === requestedStructure) || store.selectedStructure || store.structures[0]
  if (!selected) return
  store.selectedStructure = selected
  await store.requestLists(selected.structure_id)
  const requestedList = route.query.list_id
  const list = store.lists.lists.find(item => item.list_id === requestedList) || store.lists.lists[0]
  if (!list) return
  store.list_id = list.list_id
  await store.requestCategories(list.list_id)
  if (requestedStructure !== selected.structure_id || requestedList !== list.list_id) {
    await router.replace({ path: '/categories', query: { structure_id: selected.structure_id, list_id: list.list_id } })
  }
})

const addCategory = (index) => {
  window.scrollTo(0, 0)
  modalData.value = clone(store.categories.addModal)
  openModal.value = true
  action.value = 'add'
  categoryIndex.value = index
}
const editCategory = (index) => {
  window.scrollTo(0, 0)
  modalData.value = clone(store.categories.categories[index].editModal)
  openModal.value = true
  action.value = 'edit'
  categoryIndex.value = index
}
const moveCategory = async (index, direction) => {
  const target = index + direction
  if (target < 0 || target >= store.categories.categories.length) return
  const [category] = store.categories.categories.splice(index, 1)
  store.categories.categories.splice(target, 0, category)
  await store.saveCategories(store.list_id)
}
const duplicateCategory = async (index) => {
  const source = store.categories.categories[index]
  const copy = clone(source)
  copy.category_id = store.createId()
  copy.name = `${source.name} — Copy`
  const tab = copy.editModal?.[0]?.tabs?.find(entry => entry[0]?.tabLabel === store.selectedStructure.structure.language_main)
  if (tab?.[1]?.value) tab[1].value = copy.name
  store.categories.categories.splice(index + 1, 0, copy)
  await store.cloneProducts(source.category_id, copy.category_id)
  await store.saveCategories(store.list_id)
}
const deleteCategory = async (index) => {
  const category = store.categories.categories[index]
  if (!window.confirm(`${t('delete')} “${category.name}”?`)) return
  await store.deleteProducts(category.category_id)
  store.categories.categories.splice(index, 1)
  await store.saveCategories(store.list_id)
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
      // Each category needs a unique id: products are stored keyed by it, so
      // reusing a placeholder would make two categories share their dishes.
      const newCategory = {
        category_id: store.createId(),
        name: name,
        image: {
          id: 20,
          url: 'URL img',
          active: false
        },
        active: false,
        pages: 1,
        editModal: data
      }
      const insertAt = index === -1 ? store.categories.categories.length : index + 1
      store.categories.categories.splice(insertAt, 0, newCategory)
    }
    if (action === 'edit') {
      store.categories.categories[index].editModal = data
      for (let i = 0; i < data[0].tabs.length; i++) {
        if (data[0].tabs[i][0].tabLabel === store.selectedStructure.structure.language_main) {
          store.categories.categories[index].name = data[0].tabs[i][1].value
        }
      }
    }
    await store.saveCategories(store.list_id)
  }
  reRender.value = false
  await nextTick()
  reRender.value = true
  openModal.value = false
}
const toggleTuttiCategory = () => {
  tuttiCategory.value = true
  filteredCategories.value = []
}
const toggleCategory = (name) => {
  tuttiCategory.value = false
  const index = filteredCategories.value.indexOf(name)
  if (index === -1) {
    filteredCategories.value.push(name)
  } else {
    filteredCategories.value.splice(index, 1)
  }
  if (filteredCategories.value.length === 0) {
    tuttiCategory.value = true
  }
}
const toggleActive = async (category, active) => {
  // Mutate first, then persist so the public menu sees the selected state.
  category.active = active
  await store.saveCategories(store.list_id)
}
const closeFeedbackModal = () => {
  openFeedbackModal.value = !openFeedbackModal.value
}
const pushListsRoute = async () => {
  await router.push({
    path: '/lists',
    query: { structure_id: store.selectedStructure.structure_id }
  })
}
</script>

<style scoped>
.add-category {
  padding: 25px;
  border: 6px solid #e6e6e6;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.add-category h4 {
  margin: 0;
}

.buttons p {
  margin: 0 10px 0 0;
}

.category-title {
  font-weight: 700;
  font-size: 1.5rem;
  margin: 0 !important;
  border: none !important;
  padding: 0 30px !important;
}

.dropdown-content a {
  color: black;
  padding: 12px 16px;
  text-decoration: none;
  display: block;
}

.dropdown-content a:hover {
  background-color: #dff1be;
  color: #9cbf6f;
  transition: .2s all ease;
}

h3 {
  padding-right: 15px;
  padding-left: 15px;
}

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

.stato h4 {
  padding-bottom: 15px;
  margin-bottom: 15px;
  border-bottom: 1px solid #dfdfdf;
}

.stato a {
  color: #7f7f7f;
}

.stato a:hover {
  text-decoration: underline;
}

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

.add-category-btn {
  color: #9cbf6f;
  margin-top: 20px;
  display: flex;
  font-weight: bold;
  justify-content: center;
  align-items: center;
  height: 80px;
  border: 1px dashed #cdcdcd;
  cursor: pointer;
}

.add-category-btn:hover {
  background-color: rgba(197, 223, 148, .35);
  border: 1px dashed #9cbf6f;
}

a:hover, a:active, a:focus {
  color: #9cbf6f;
}

.sezioni h4 {
  padding-bottom: 15px;
  margin-bottom: 15px;
  border-bottom: 1px solid #dfdfdf;
}

.sezioni a {
  color: #7f7f7f;
}

.sezioni a:hover {
  text-decoration: underline;
}

.sezioni-checkboxes label, .sezioni-checkboxes input {
  cursor: pointer;
  color: #7f7f7f;
}

.sezioni-checkboxes input {
  margin-right: 5px;
}

.sezioni-checkboxes div {
  margin: 5px 0 0 0;
  display: flex;
  align-items: center;
}

.aside > .grey-link { display: inline-flex; }
.sezioni h4, .stato h4 {
  margin: var(--s-4) 0 var(--s-3);
  padding-bottom: var(--s-2);
  border-color: var(--c-line);
  color: var(--c-ink-2);
  font-size: 0.825rem;
}
.sezioni-checkboxes label, .stato-checkboxes label { font-size: 0.85rem; color: var(--c-ink-2); }
.feedback-modal { font-size: 0.85rem; color: var(--c-ink-2); }
.add-category { padding: var(--s-4); border: 1px solid var(--c-line); border-radius: var(--r-md); }
.category-title { padding: 0 !important; font-size: 1.125rem; }
.add-category-btn { display: none; }
.workspace-sidebar { display: grid; align-content: start; gap: var(--s-4); }.back-link { justify-content: flex-start; width: fit-content; }.sidebar-group { display: grid; gap: var(--s-2); padding: var(--s-4) 0; border-top: 1px solid var(--c-line); }.sidebar-group h2 { color: var(--c-ink-3); font-size: .75rem; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }.section-filter-list { display: grid; gap: 2px; }.section-filter { min-height: 34px; padding: 0 var(--s-2); color: var(--c-ink-2); text-align: left; font: 600 .84rem/1.2 inherit; background: transparent; border: 0; border-radius: var(--r-sm); cursor: pointer; }.section-filter:hover { color: var(--c-ink); background: var(--c-line-2); }.section-filter.is-active { color: var(--c-brand); background: var(--c-brand-soft); }.feedback-link { padding: 0; color: var(--c-ink-2); text-align: left; font: 600 .85rem/1.4 inherit; background: transparent; border: 0; cursor: pointer; }.feedback-link:hover { color: var(--c-brand); text-decoration: underline; }.page-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-4); padding-bottom: var(--s-5); border-bottom: 1px solid var(--c-line); }.page-toolbar h1 { font-size: 1.55rem; }.page-toolbar p { margin-top: var(--s-1); font-size: .875rem; }.categories { margin-top: var(--s-1); }
@media (max-width: 600px) { .page-toolbar { flex-direction: column; }.page-toolbar .btn { width: 100%; } }
</style>
