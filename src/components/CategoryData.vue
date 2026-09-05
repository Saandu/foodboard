<template>
  <article v-if="reRender" v-show="display !== 'none'" class="category-editor" ref="target">
    <header class="category-editor__header">
      <div><span class="category-editor__index">{{ $t('sections') }} {{ props.index + 1 }}</span><h2>{{ name }}</h2></div>
      <div class="category-editor__actions">
        <label class="category-status"><input type="checkbox" :checked="active" @change="toggleActive"><span>{{ active ? $t('published') : $t('drafts') }}</span></label>
        <button type="button" class="icon-btn" :disabled="props.index === 0" :aria-label="$t('move_up')" @click="moveCategory(-1)"><font-awesome-icon icon="fa-solid fa-circle-arrow-up" /></button>
        <button type="button" class="icon-btn" :disabled="props.index === store.categories.categories.length - 1" :aria-label="$t('move_down')" @click="moveCategory(1)"><font-awesome-icon icon="fa-solid fa-circle-arrow-down" /></button>
        <details class="category-menu"><summary :aria-label="$t('actions')">•••</summary><div><button type="button" @click="editCategory">{{ $t('edit') }}</button><button type="button" @click="duplicateCategory">{{ $t('duplicate') }}</button><button type="button" class="is-danger" @click="deleteCategory">{{ $t('delete') }}</button></div></details>
      </div>
    </header>
    <div class="products-heading"><span>{{ $t('product_name') }}</span><span>{{ $t('status') }}</span></div>
    <div class="products-list">
      <!-- v-if on a <template> wrapper rather than beside the v-for: on one
           element v-for wins and the condition is re-tested per row. The loop
           variable is not named `index` because this component already takes an
           `index` prop of its own. -->
      <template v-if="isListProductsLoaded">
        <ProductShortData v-for="(product, rowIndex) in products" :key="`${product.name}-${rowIndex}`"
                          :type="product.type" :product="product" :name="product.name" :index="rowIndex"
                          @toggle-active="toggleProductActive(rowIndex)"
                          @edit-product="editProduct(rowIndex, product.type)"
                          @duplicate-product="duplicateProduct(rowIndex)"
                          @delete-product="deleteProduct(rowIndex)" />
      </template>
    </div>
    <div class="category-editor__footer">
      <button type="button" class="btn btn-quiet" @click="addProduct(-1)">{{ products.length ? $t('add_product') : $t('create_first_product') }}</button>
      <button type="button" class="btn btn-text" @click="addDivisor(-1)">{{ $t('insert_divisor') }}</button>
    </div>
    <DynamicModal :open="openModal" :modal-label="currentModalLabel" @close-modal="closeModal" :modal-data="modalData" :index="productIndex" :action="action" :type="currentProductType" @add-price="addPrice" @remove-price="removePrice" @add-description="addDescription" @remove-description="removeDescription" />
  </article>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { nextTick, onBeforeMount, onMounted, ref, watch } from 'vue'
import { useElementVisibility } from '@vueuse/core'
import { useStore } from '../stores/store.js'
import { useI18n } from 'vue-i18n'
import ProductShortData from './ProductShortData.vue'
import DynamicModal from './DynamicModal.vue'
import { clone } from '../clone.js'

const store = useStore()
const { t } = useI18n()

const emits = defineEmits(['toggleActive', 'editCategory', 'moveCategory', 'duplicateCategory', 'deleteCategory'])
const props = defineProps({
  active: {
    type: Boolean,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  // Named for the column it mirrors rather than camelCased, so the descriptor
  // and the prop read the same in both places.
  // eslint-disable-next-line vue/prop-name-casing
  category_id: {
    type: String,
    required: true
  },
  index: {
    type: Number,
    required: true
  },
  display: {
    type: String,
    default: ''
  }
})

const target = ref(null)
let targetIsVisible = useElementVisibility(target)
const isListProductsLoaded = ref(false)
const products = ref([])

const openModal = ref(false)
const modalData = ref({})
const productIndex = ref(-1)
const action = ref('add')
const currentModalLabel = ref('')
let currentProductType = ''

let addProductModal = {}
let addDivisorModal = {}
const reRender = ref(true)

const loadProducts = async () => {
  if (props.category_id !== '-1') {
    const res = await store.requestProducts(props.category_id)
    addProductModal = res.addProductModal || []
    addDivisorModal = res.addDivisorModal || []
    products.value = res.products || []
    isListProductsLoaded.value = true
  } else {
    products.value = []
  }
}

onBeforeMount(async () => {
  targetIsVisible = useElementVisibility(target)
  await loadProducts()
})
onMounted(async () => {
  reRender.value = false
  await nextTick()
  reRender.value = true
})
watch(targetIsVisible, async () => {
  if (!isListProductsLoaded.value) {
    await loadProducts()
  }
})

const editCategory = () => {
  emits('editCategory', props.category_id, props.index)
}
const moveCategory = (direction) => emits('moveCategory', props.index, direction)
const duplicateCategory = () => emits('duplicateCategory', props.index)
const deleteCategory = () => emits('deleteCategory', props.index)
const addDivisor = (index) => {
  window.scrollTo(0, 0)
  productIndex.value = index
  currentModalLabel.value = t('insert_divisor')
  currentProductType = 'divisor'
  action.value = 'add'
  modalData.value = clone(addDivisorModal)
  openModal.value = true
}
const addProduct = (index) => {
  window.scrollTo(0, 0)
  productIndex.value = index
  currentModalLabel.value = t('add_product')
  currentProductType = 'product'
  action.value = 'add'
  modalData.value = clone(addProductModal)
  openModal.value = true
}
const editProduct = (index, type) => {
  window.scrollTo(0, 0)
  productIndex.value = index
  currentProductType = type
  currentModalLabel.value = t('edit')
  action.value = 'edit'
  modalData.value = clone(products.value[index].editModal)
  openModal.value = true

}
const addPrice = (data) => {
  const editedModal = clone(data)
  editedModal[0].tabs.forEach(tab => {
    if (tab.find(item => item.type === 'prices')) {
      tab.find(item => item.type === 'prices').value.push({
        type: 'text',
        suffix: '',
        value: ''
      })
    }
  })
  openModal.value = false
  modalData.value = clone(editedModal)
  openModal.value = true
}
const removePrice = (data, index) => {
  const editedModal = clone(data)
  editedModal[0].tabs.forEach(tab => {
    if (tab.find(item => item.type === 'prices')) {
      tab.find(item => item.type === 'prices').value.splice(index, 1)
    }
  })
  openModal.value = false
  modalData.value = clone(editedModal)
  openModal.value = true
}
const addDescription = (data) => {
  const editedModal = clone(data)
  editedModal[0].tabs.forEach(tab => {
    if (tab.find(item => item.type === 'description_rows')) {
      tab.find(item => item.type === 'description_rows').value.push({
        type: 'text',
        value: ''
      })
    }
  })
  openModal.value = false
  modalData.value = clone(editedModal)
  openModal.value = true
}
const removeDescription = (data, index) => {
  const editedModal = clone(data)
  editedModal[0].tabs.forEach(tab => {
    if (tab.find(item => item.type === 'description_rows')) {
      tab.find(item => item.type === 'description_rows').value.splice(index, 1)
    }
  })
  openModal.value = false
  modalData.value = clone(editedModal)
  openModal.value = true
}
const closeModal = async (data, index, action, type) => {
  if (data !== null) {
    if (action === 'add') {
      let name
      for (let i = 0; i < data[0].tabs.length; i++) {
        if (data[0].tabs[i][0].tabLabel === store.selectedStructure.structure.language_main) {
          name = data[0].tabs[i][1].value
        }
      }
      // Build the new entry complete, then insert it. Assigning editModal by
      // index afterwards used to write it onto the wrong product.
      const newProduct = {
        name: name,
        type: type,
        editModal: data
      }
      if (type === 'product') {
        newProduct.active = true
        newProduct.image = { id: 20, url: 'URL img', active: true }
      }
      const insertAt = index === -1 ? products.value.length : index + 1
      products.value.splice(insertAt, 0, newProduct)
    }
    if (action === 'edit') {
      products.value[index].editModal = data
      for (let i = 0; i < data[0].tabs.length; i++) {
        if (data[0].tabs[i][0].tabLabel === store.selectedStructure.structure.language_main) {
          products.value[index].name = data[0].tabs[i][1].value
        }
      }
    }
    await store.saveProducts(props.category_id, products.value, addProductModal, addDivisorModal)
  }
  modalData.value = clone(addProductModal)
  openModal.value = false
}
const toggleActive = () => {
  const activeChanged = !props.active
  emits('toggleActive', activeChanged)
}
const persistProducts = () => store.saveProducts(props.category_id, products.value, addProductModal, addDivisorModal)
const toggleProductActive = async (index) => {
  const product = products.value[index]
  if (!product || product.type === 'divisor') return
  // `active` is the canonical public-menu status. The image field is kept
  // in sync for existing records so legacy public-menu data cannot override it.
  product.active = !(product.active ?? product.image?.active ?? true)
  if (product.image) product.image.active = product.active
  await persistProducts()
}
const duplicateProduct = async (index) => {
  const copy = clone(products.value[index])
  copy.name = `${copy.name} — Copy`
  const mainLanguage = store.selectedStructure?.structure?.language_main
  const tab = copy.editModal?.[0]?.tabs?.find(entry => entry[0]?.tabLabel === mainLanguage)
  if (tab?.[1]?.value) tab[1].value = copy.name
  products.value.splice(index + 1, 0, copy)
  await persistProducts()
}
const deleteProduct = async (index) => {
  if (!window.confirm(`${t('delete')} “${products.value[index].name}”?`)) return
  products.value.splice(index, 1)
  await persistProducts()
}
</script>

<style scoped>
.add-product-btn {
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

.add-product-btn:hover {
  background-color: rgba(197, 223, 148, .35);
  border: 1px dashed #9cbf6f;
}

.line {
  border-bottom: 2px solid rgba(0, 0, 0, 0.15);
  height: 10px;
  transform: translateY(-12px);
  margin-bottom: 20px;
}

.add-btn {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  margin-top: -17px;
  color: #9cbf6f;
  cursor: pointer;
  transition: .15s all ease-in;

}

/*.dropdown-btn {*/
/*  margin-right: -5px;*/
/*  padding: 10px 5px;*/
/*  background-color: #e1e1e1;*/
/*  border-radius: 3px;*/
/*  display: flex;*/
/*  justify-content: center;*/
/*  align-items: center;*/
/*}*/


.dropdown-plus {
  width: 25px;
  height: 25px;
  border: 3px solid #9cbf6f;
  font-weight: bold;
  align-items: center;
  justify-content: center;
  display: flex;
  font-size: 2rem;
  border-radius: 100%;
  transition: .15s all ease-in;

}

.dropdown-plus:hover {
  background-color: #9cbf6f;
  color: #ffffff;
  transition: .15s all ease-in;
  outline: #9cbf6f;
}

.add-btn .dropdown-content {
  font-size: 1rem;
  margin-top: 5px;
  display: none;
  position: absolute;
  z-index: 2;
  background-color: #fff;
  border: 1px solid rgba(0, 0, 0, 0.15);
  min-width: 120px;
  text-align: center;
  transform: translateX(-43%);
}

.add-btn .dropdown-content .menu-option {
  padding: 10px 15px;
  cursor: pointer;
}

.menu-option {
  min-width: 180px;
  padding: 5px 50px 5px 10px;
  cursor: pointer;
}

.menu-option:hover {
  color: black;
  background-color: #e7e7e7;
}

.dropdown-btn {
  color: rgba(0, 0, 0, .5);
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
}

.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-content {
  display: none;
  position: absolute;
  background-color: #fff;
  border: 1px solid rgba(0, 0, 0, 0.15);
  min-width: 260px;
  z-index: 1;
  transform: translateX(-60%);
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

.dropdown:hover .dropdown-content {
  display: block;
}

.dropdown-btn {
  margin-right: -5px;
  padding: 10px 15px;
  background-color: #e1e1e1;
  border-radius: 3px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.dropdown-btn:hover {
  background-color: #d1d1d1;
}

.dropdown-btn svg {
  width: 20px;
}

.dropdown:hover .dropdown-btn {
  color: #000;
  transition: .2s all ease;
}

.dropdown .dropdown-btn:focus {
  outline: none;
}

.category {
  padding: 25px;
  border: 6px solid #e6e6e6;
  border-radius: 20px;
  margin-bottom: 40px;
  transition: all 0.3s ease;
}

.buttons {
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

.category-settings {
  display: flex;
  justify-content: flex-end !important;
  align-items: center;
  margin: 0 !important;
  border: none !important;
  padding: 0 30px !important;
}

.category-edit {
  background-color: #e6e5e1;
  padding: 0.6rem 0.8rem 1.2rem;
  line-height: .6rem;
  border-radius: 5px;
  font-size: 1.4rem;
  cursor: pointer;
  display: inline-block;
}

.buttons p {
  cursor: pointer;
  margin: 0 10px 0 0;
}

.svg-inline--fa {
  height: 2.5em;
}

h4 {
  font-weight: 700;
  font-size: 1.5rem;
  margin: 0;
}

.category-title {
  font-weight: 700;
  font-size: 1.5rem;
  margin: 0 !important;
  border: none !important;
  padding: 0 30px !important;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  padding: 20px 30px;
  border-bottom: 1px solid #cdcdcd;
  border-top: 1px solid #cdcdcd;
  margin-top: 30px;
}

.tab-title {
  color: #7f7f7f;
}

.tab-items {
  display: none;
  gap: var(--s-6);
  color: var(--c-ink-3);
  font-size: 0.85rem;
  font-weight: 600;
}

@media (min-width: 720px) {
  .tab-items { display: flex; }
}

.tab-items > span {
  min-width: 40px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
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
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  -webkit-transition: .4s;
  transition: .4s;
}

input:checked + .slider {
  background-color: var(--c-brand);
}

input:focus + .slider {
  box-shadow: 0 0 1px #c5df94;
}

input:checked + .slider:before {
  -ms-transform: translateX(18px);
  transform: translateX(18px);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

.red {
  color: #b91919;
}

.red:hover {
  color: #ff0000;
}

/* Compact, consistent category editor */
.category {
  padding: var(--s-4);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  margin-bottom: var(--s-6);
}

.buttons { gap: var(--s-1); }
.icon-btn {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-ink-3);
  cursor: pointer;
}
.icon-btn:hover:not(:disabled) { background: var(--c-line-2); color: var(--c-ink); }
.icon-btn:disabled { opacity: 0.35; }
.icon-btn--danger:hover { color: var(--c-danger); background: var(--c-danger-soft); }
.icon-btn .svg-inline--fa { height: 1.1em; }

h4, .category-title { font-size: 1.125rem; }
.category-title, .category-settings { padding: 0 !important; }
.tab-header { padding: var(--s-3) 0; margin-top: var(--s-4); border-color: var(--c-line); }
.tab-title { color: var(--c-ink-3); font-size: 0.8rem; font-weight: 650; }
.dropdown-content { right: 0; min-width: 180px; transform: none; z-index: var(--z-dropdown); border-color: var(--c-line); border-radius: var(--r-sm); padding: var(--s-1); }
.dropdown-btn { padding: var(--s-2); margin: 0; border-radius: var(--r-sm); background: var(--c-line-2); }
.menu-option { min-width: 0; padding: 8px var(--s-3); border-radius: 6px; font-size: 0.875rem; }
.dropdown-plus { width: 30px; height: 30px; border: 2px solid var(--c-brand); font-size: 1.35rem; color: var(--c-brand); }
.dropdown-plus:hover { background: var(--c-brand); outline-color: var(--c-brand); }
.add-product-btn { min-height: 72px; height: auto; border-radius: var(--r-sm); color: var(--c-brand); }

@media (max-width: 560px) {
  .category { padding: var(--s-3); }
  .category-title h4 { overflow-wrap: anywhere; }
}

.category-editor { margin: var(--s-5) 0; border: 1px solid var(--c-line); border-radius: var(--r-md); background: var(--c-surface); overflow: visible; }
.category-editor__header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-4); padding: var(--s-4); border-bottom: 1px solid var(--c-line); }.category-editor__index { display: block; margin-bottom: var(--s-1); color: var(--c-ink-3); font-size: .72rem; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }.category-editor__header h2 { font-size: 1.15rem; }.category-editor__actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--s-1); }.category-status { display: inline-flex; align-items: center; gap: 6px; margin-right: var(--s-1); color: var(--c-ink-3); font-size: .78rem; font-weight: 650; cursor: pointer; }.category-status input { width: 15px; height: 15px; accent-color: var(--c-brand); }.category-menu { position: relative; }.category-menu summary { display: grid; place-items: center; width: 34px; height: 34px; list-style: none; color: var(--c-ink-2); letter-spacing: 1px; border-radius: var(--r-sm); cursor: pointer; }.category-menu summary::-webkit-details-marker { display: none; }.category-menu summary:hover { background: var(--c-line-2); }.category-menu > div { position: absolute; top: calc(100% + var(--s-1)); right: 0; z-index: var(--z-dropdown); display: grid; min-width: 160px; padding: var(--s-1); background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--r-md); box-shadow: var(--shadow-sm); }.category-menu button { min-height: 36px; padding: 0 var(--s-2); color: var(--c-ink-2); text-align: left; font: 600 .85rem/1 inherit; background: transparent; border: 0; border-radius: var(--r-sm); cursor: pointer; }.category-menu button:hover { color: var(--c-ink); background: var(--c-line-2); }.category-menu .is-danger { color: var(--c-danger); }.category-menu .is-danger:hover { color: var(--c-danger); background: var(--c-danger-soft); }.products-heading { display: flex; justify-content: space-between; padding: var(--s-2) var(--s-4); color: var(--c-ink-3); font-size: .72rem; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; border-bottom: 1px solid var(--c-line); }.products-list { min-width: 0; }.category-editor__footer { display: flex; flex-wrap: wrap; gap: var(--s-2); padding: var(--s-3) var(--s-4); border-top: 1px solid var(--c-line); }
@media (max-width: 600px) { .category-editor__header { flex-direction: column; }.category-editor__actions { justify-content: flex-start; }.category-status { margin-right: var(--s-2); }.category-editor__footer .btn { flex: 1 1 auto; } }
</style>
