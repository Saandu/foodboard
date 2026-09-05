import { defineStore } from 'pinia'
import { supabase } from '../supabase.js'
import { clone } from '../clone.js'
import { removeAllStructureMedia, removeStructureImages } from '../media.js'
import { normalizeStructure, blankStructure, unwrapTabs, DEFAULT_COLOR_MAIN, DEFAULT_COLOR_BACKGROUND } from '../structureShape.js'
import { deleteAccount as deleteAccountRow, fetchUser } from '../api/users.js'
import { fetchStructures, insertStructure, rotatePublicSlug as rotateSlug, upsertStructure } from '../api/structures.js'
import { deleteList as deleteListRow, fetchLists, insertList, upsertList } from '../api/lists.js'
import {
  deleteCategoriesForList,
  fetchCategories,
  fetchCategoryGroup,
  insertCategories,
  upsertCategories
} from '../api/categories.js'
import { deleteProducts as deleteProductRows, deleteProductsIn, fetchProducts, upsertProducts } from '../api/products.js'
import { insertFeedback } from '../api/feedback.js'

/** In-flight bootstrap, so concurrent navigations share one round trip.
 *  Module scope rather than store state: it is a promise, not data. */
let sessionBootstrap = null

/** How long the "Saved" confirmation stays up, and how long saving is locked. */
const SAVED_HINT_MS = 2500
const SAVE_LOCK_MS = 1000

/** The default nav settings for an account whose row has none. */
const defaultSettings = () => ({
  account: { url: '#', label: 'account_link', target: '_self' },
  menu: { url: '#', label: 'profile_link', target: '_self' },
  logout: { url: '/login', label: 'logout', target: '_self' }
})

export const useStore = defineStore('store', {
  state: () => ({
    // Language tab order in the editor. Keep in sync with LANGS in scripts/shapes.js.
    tabs: [
      { id: 'it', disabled: false },
      { id: 'en', disabled: true },
      { id: 'ro', disabled: true },
      { id: 'es', disabled: true },
      { id: 'de', disabled: true },
      { id: 'fr', disabled: true },
      { id: 'ru', disabled: true },
      { id: 'zh', disabled: true },
      { id: 'ja', disabled: true }
    ],
    // Endonyms, so each language reads correctly whatever the admin's UI locale is.
    allLanguages: [
      { name: 'Italiano', id: 'it' },
      { name: 'English', id: 'en' },
      { name: 'Română', id: 'ro' },
      { name: 'Español', id: 'es' },
      { name: 'Deutsch', id: 'de' },
      { name: 'Français', id: 'fr' },
      { name: 'Русский', id: 'ru' },
      { name: '中文', id: 'zh' },
      { name: '日本語', id: 'ja' }
    ],
    allCurrencies: [
      { name: '€', id: '€' },
      { name: '$', id: '$' },
      { name: '£', id: '£' }
    ],
    allCurrenciesOptions: ['€', '$', '£'],
    // The 14 EU-listed allergens. `key` resolves through vue-i18n at render time.
    allAllergens: [
      { key: 'a_molluscs', id: '1' },
      { key: 'a_fish', id: '2' },
      { key: 'a_sesame', id: '3' },
      { key: 'a_soy', id: '4' },
      { key: 'a_crustaceans', id: '5' },
      { key: 'a_gluten', id: '6' },
      { key: 'a_lupin', id: '7' },
      { key: 'a_celery', id: '8' },
      { key: 'a_sulphites', id: '9' },
      { key: 'a_mustard', id: '10' },
      { key: 'a_eggs', id: '11' },
      { key: 'a_peanuts', id: '12' },
      { key: 'a_nuts', id: '13' },
      { key: 'a_milk', id: '14' }
    ],

    user: {
      user_id: '',
      name: '',
      surname: '',
      settings: defaultSettings()
    },
    structures: [],
    lists: { structure_id: '', lists: [] },
    listsByStructure: {},
    categories: { list_id: '', categories: [], addModal: [], addCategoryModal: [] },
    categoriesByList: {},
    productsByCategory: {},

    list_id: '',

    isHeaderLoaded: false,
    isQrOpen: false,
    isStructureLoaded: false,
    isListLoaded: false,
    isCategoryLoaded: false,
    isProductLoaded: true,

    selectedStructure: null,

    isStructureSavable: true,
    /** Set briefly after a successful save so the UI can confirm it. */
    structureSaved: false,
    /** A user-visible key for persistence failures in the editor. */
    saveError: '',
    /** True once the signed-in account's workspace has been loaded. Guards
     *  against the app shell rendering before there is a user to render. */
    sessionLoaded: false,
    /** Storage paths to drop once the structure that referenced them is saved.
     *  Deleting on click would break the published menu if the edit is then
     *  abandoned, so removal waits for the row to actually change. */
    pendingMediaRemovals: []
  }),

  actions: {
    /**
     * Loads the signed-in account's workspace, once.
     *
     * Bootstrapping used to live in App.vue's onBeforeMount, which runs a
     * single time and skipped public pages entirely. Landing on '/' or
     * '/login' while already signed in therefore left the store empty, and a
     * later client-side navigation into the dashboard rendered it without a
     * header — nothing re-ran the bootstrap. The router awaits this instead.
     */
    async ensureSession () {
      if (this.sessionLoaded) return true
      if (sessionBootstrap) return sessionBootstrap

      sessionBootstrap = (async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return false
        await this.requestUser(session.user)
        await this.requestStructures(session.user.id)
        this.sessionLoaded = true
        return true
      })().finally(() => { sessionBootstrap = null })

      return sessionBootstrap
    },

    /** Drops the loaded workspace so the next account starts clean. */
    clearSession () {
      sessionBootstrap = null
      this.$reset()
    },

    /**
     * Removes the images queued by a delete, now that the row that referenced
     * them has actually changed. Called after a successful save so abandoning
     * an edit cannot break a published menu.
     */
    async flushPendingMediaRemovals () {
      if (!this.pendingMediaRemovals.length) return
      const removals = this.pendingMediaRemovals
      this.pendingMediaRemovals = []
      await removeStructureImages(removals)
    },

    async requestUser (authUser) {
      if (!authUser?.id) return
      try {
        const row = await fetchUser(authUser.id)
        this.user = row
          ? {
            ...row,
            settings: Object.keys(row.settings || {}).length ? row.settings : defaultSettings()
          }
          : {
            user_id: authUser.id,
            name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'FoodBoard user',
            surname: '',
            settings: defaultSettings()
          }
      } catch (error) {
        console.error(error)
      } finally {
        this.isHeaderLoaded = true
      }
    },

    async requestStructures (userId) {
      try {
        const data = await fetchStructures(userId)
        if (data?.length) {
          this.structures = data.map(row => ({
            ...row,
            structure: normalizeStructure(row.structure, row.title)
          }))
          this.selectedStructure = this.structures[0]
          this.updateTabs()
        } else {
          this.structures = []
          this.selectedStructure = null
        }
      } catch (error) {
        console.error(error)
      } finally {
        this.isStructureLoaded = true
      }
    },

    async requestLists (structureId, force = false) {
      if (!force && this.listsByStructure[structureId]) {
        this.lists = this.listsByStructure[structureId]
        if (!this.list_id || !this.lists.lists.some(list => list.list_id === this.list_id)) {
          this.list_id = this.lists.lists[0]?.list_id || ''
        }
        this.isListLoaded = true
        return this.lists
      }

      this.isListLoaded = false
      try {
        const data = await fetchLists(structureId)
        if (data?.length) {
          const parsedLists = data.map(row => (
            row.data && typeof row.data === 'object'
              ? {
                ...row.data,
                list_id: row.list_id,
                name: row.title || row.data.name,
                active: row.is_active ?? row.data.active
              }
              : { list_id: row.list_id, name: row.title, active: row.is_active, count: 0, category: 0, editModal: [] }
          ))
          // "Create list" clones this blank descriptor, so it has to be present
          // at the group level or the add modal opens empty.
          const addModal = parsedLists.find(list => list.addModal)?.addModal
            || this.blankModalFrom(parsedLists[0]?.editModal)
          this.lists = { structure_id: structureId, lists: parsedLists, addModal }
          this.list_id = parsedLists[0].list_id
        } else {
          this.lists = { structure_id: structureId, lists: [], addModal: [] }
        }
        this.listsByStructure[structureId] = this.lists
      } catch (error) {
        console.error(error)
      } finally {
        this.isListLoaded = true
      }
    },

    /** Copies a form descriptor with every value cleared, for "add" modals. */
    blankModalFrom (modal) {
      if (!Array.isArray(modal) || !modal.length) return []
      const blank = clone(modal)
      const clear = (field) => {
        if (Array.isArray(field.value)) {
          field.value.forEach(entry => {
            if (entry && typeof entry === 'object') clear(entry)
          })
        } else if (typeof field.value === 'string') {
          field.value = ''
        }
        if (typeof field.suffix === 'string') field.suffix = ''
        if (Array.isArray(field.tabs)) {
          field.tabs.forEach(tab => tab.forEach(f => { if (!f.tabLabel) clear(f) }))
        }
      }
      blank.forEach(clear)
      return blank
    },

    /** Unique id for newly created restaurants, lists and categories. */
    createId () {
      return crypto.randomUUID()
    },

    async saveLists (structureId) {
      if (!this.lists?.lists) return false
      this.saveError = ''
      try {
        for (const list of this.lists.lists) {
          await upsertList({
            listId: list.list_id,
            structureId,
            userId: this.user.user_id,
            title: list.name,
            isActive: list.active ?? true,
            data: clone(list)
          })
        }
        return true
      } catch (error) {
        console.error(error)
        this.saveError = 'save_failed'
        return false
      }
    },

    async deleteList (listId) {
      const groups = await fetchCategoryGroup(listId)
      const categoryIds = (groups || [])
        .flatMap(group => (group.category?.categories || []).map(category => category.category_id))
        .filter(Boolean)

      await deleteProductsIn(categoryIds)
      await deleteCategoriesForList(listId)
      await deleteListRow(listId)
    },

    /**
     * Copies a menu, its categories and every dish into a new inactive menu.
     *
     * The copy is created inactive so duplicating a published menu cannot
     * change what diners see.
     */
    async duplicateList (sourceList, structureId) {
      const newListId = this.createId()
      const userId = this.user.user_id
      const copy = clone(sourceList)
      copy.list_id = newListId
      copy.name = `${sourceList.name} — Copy`
      copy.active = false

      await insertList({
        listId: newListId,
        structureId,
        userId,
        title: copy.name,
        isActive: false,
        data: copy
      })

      const groups = await fetchCategoryGroup(sourceList.list_id)
      const sourceGroup = groups?.[0]?.category
      if (!sourceGroup) return copy

      // Categories keep their structure but need fresh ids, and each one's
      // dishes live in a row keyed by that id — so remember the mapping.
      const idMap = new Map()
      const copiedCategories = clone(sourceGroup.categories || []).map(category => {
        const newCategoryId = this.createId()
        idMap.set(category.category_id, newCategoryId)
        category.category_id = newCategoryId
        return category
      })

      await insertCategories({
        listId: newListId,
        userId,
        category: { ...clone(sourceGroup), categories: copiedCategories }
      })

      for (const [sourceCategoryId, targetCategoryId] of idMap) {
        await this.cloneProducts(sourceCategoryId, targetCategoryId)
      }
      return copy
    },

    async requestCategories (listId, force = false) {
      if (!force && this.categoriesByList[listId]) {
        this.categories = this.categoriesByList[listId]
        this.list_id = listId
        this.isCategoryLoaded = true
        return this.categories
      }

      this.isCategoryLoaded = false
      this.list_id = listId
      try {
        const data = await fetchCategories(listId)
        const group = data?.[0]?.category || {}
        const addModal = group.addCategoryModal || group.addModal || []
        this.categories = {
          list_id: listId,
          categories: group.categories || [],
          addModal,
          addCategoryModal: addModal
        }
        this.categoriesByList[listId] = this.categories
      } catch (error) {
        console.error(error)
      } finally {
        this.isCategoryLoaded = true
      }
    },

    async saveCategories (listId) {
      if (!this.categories) return false
      this.saveError = ''
      try {
        await upsertCategories({
          listId,
          userId: this.user.user_id,
          category: {
            categories: clone(this.categories.categories || []),
            addCategoryModal: clone(this.categories.addCategoryModal || this.categories.addModal || [])
          }
        })
        await this.flushPendingMediaRemovals()
        return true
      } catch (error) {
        console.error(error)
        this.saveError = 'save_failed'
        return false
      }
    },

    async requestProducts (categoryId, force = false) {
      if (!force && this.productsByCategory[categoryId]) return this.productsByCategory[categoryId]

      let group = {}
      try {
        const data = await fetchProducts(categoryId)
        group = data?.[0]?.product || {}
      } catch (error) {
        console.error(error)
      }

      const result = {
        category_id: categoryId,
        products: group.products || [],
        addProductModal: group.addProductModal || [],
        addDivisorModal: group.addDivisorModal || []
      }
      this.productsByCategory[categoryId] = result
      return result
    },

    async saveProducts (categoryId, products, addProductModal, addDivisorModal) {
      this.saveError = ''
      const product = {
        products: clone(products || []),
        addProductModal: clone(addProductModal || []),
        addDivisorModal: clone(addDivisorModal || [])
      }
      try {
        await upsertProducts({ categoryId, userId: this.user.user_id, product })
        this.productsByCategory[categoryId] = { category_id: categoryId, ...product }
        await this.flushPendingMediaRemovals()
        return true
      } catch (error) {
        console.error(error)
        this.saveError = 'save_failed'
        return false
      }
    },

    async cloneProducts (sourceCategoryId, targetCategoryId) {
      const source = await this.requestProducts(sourceCategoryId)
      return this.saveProducts(
        targetCategoryId,
        clone(source.products),
        clone(source.addProductModal),
        clone(source.addDivisorModal)
      )
    },

    async deleteProducts (categoryId) {
      await deleteProductRows(categoryId)
      delete this.productsByCategory[categoryId]
    },

    async switchStructure (index) {
      this.selectedStructure = this.structures[index]
      this.updateTabs()
      await this.requestLists(this.selectedStructure.structure_id)
    },

    updateTabs () {
      const languages = this.selectedStructure?.structure?.languages
      if (!languages) return
      this.tabs.forEach(tab => { tab.disabled = !languages.includes(tab.id) })
    },

    updateSelectedLanguages (lang) {
      const structure = this.selectedStructure.structure
      structure.languages = structure.languages.includes(lang)
        ? structure.languages.filter(item => item !== lang)
        : [...structure.languages, lang]
      this.updateTabs()
    },

    /** Moves the main language to the front, where the editor expects it. */
    rearrangeTabs () {
      const mainLanguage = this.selectedStructure?.structure?.language_main
      const index = this.tabs.findIndex(tab => tab.id === mainLanguage)
      if (index > 0) this.tabs.unshift(this.tabs.splice(index, 1)[0])
    },

    updateMainLanguage (lang) {
      this.selectedStructure.structure.language_main = lang
      this.updateTabs()
      this.rearrangeTabs()
    },

    updateMainCurrency (currency) {
      this.selectedStructure.structure.currency = currency
    },

    async createStructure () {
      const name = 'My restaurant'
      const created = await insertStructure({
        structureId: this.createId(),
        userId: this.user.user_id,
        title: name,
        structure: blankStructure(name)
      })
      this.structures = [...this.structures, created]
      this.selectedStructure = created
      this.updateTabs()
      return created
    },

    /** Issues a new public slug, which immediately breaks the previous link. */
    async rotatePublicSlug (structureId) {
      const slug = await rotateSlug(structureId)
      const target = this.structures.find(item => item.structure_id === structureId)
      if (target) target.public_slug = slug
      if (this.selectedStructure?.structure_id === structureId) this.selectedStructure.public_slug = slug
      return slug
    },

    async saveStructure () {
      this.isStructureSavable = false
      this.structureSaved = false
      this.saveError = ''
      try {
        const structure = clone(this.selectedStructure.structure)
        await upsertStructure({
          structureId: this.selectedStructure.structure_id,
          userId: this.user.user_id,
          title: this.selectedStructure.title,
          structure: { ...structure, description: unwrapTabs(structure.description) }
        })
        await this.flushPendingMediaRemovals()
        this.structureSaved = true
        setTimeout(() => { this.structureSaved = false }, SAVED_HINT_MS)
        return true
      } catch (error) {
        console.error(error)
        this.saveError = 'save_failed'
        return false
      } finally {
        setTimeout(() => { this.isStructureSavable = true }, SAVE_LOCK_MS)
      }
    },

    resetMainColor () {
      this.selectedStructure.structure.color_main = DEFAULT_COLOR_MAIN
    },

    resetBackgroundColor () {
      this.selectedStructure.structure.color_background = DEFAULT_COLOR_BACKGROUND
    },

    /**
     * Closes the signed-in account for good.
     *
     * Stored images go first, while the session can still reach the Storage
     * API — the SQL cascade behind delete_account() is not allowed to touch
     * storage.objects. Then the auth user is removed, and an `after delete`
     * trigger on auth.users clears the workspace tables.
     */
    async deleteAccount () {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('not_authenticated')

      await removeAllStructureMedia(user.id)
      await deleteAccountRow()

      await supabase.auth.signOut()
      this.$reset()
    },

    /** Files a feedback report. Throws a translation key on failure. */
    async sendFeedback ({ subject, message, attachment }) {
      try {
        await insertFeedback({ userId: this.user.user_id, subject, message, attachment })
      } catch (error) {
        console.error(error)
        // The message is a translation key for the modal; the original error
        // travels as `cause` so it is still there when debugging.
        throw new Error('feedback_failed', { cause: error })
      }
    }
  }
})
