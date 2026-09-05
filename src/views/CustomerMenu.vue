<template>
  <div class="menu" :class="themeClass" v-if="!loading && structure && menuIsActive" :style="pageStyle">
   <div class="sheet">
    <!-- Hero -->
    <header class="hero">
      <div class="hero__inner">
        <div class="hero__bar">
          <span class="hero__eyebrow">{{ listTitle }}</span>

          <div class="lang" v-if="availableLanguages.length > 1">
            <LanguagePicker v-model="currentLang" :options="languageOptions" :label="copy.language" inverse />
          </div>
        </div>

        <img v-if="logo" :src="logo" class="hero__logo" :alt="restaurantName">
        <h1 class="hero__name">{{ restaurantName }}</h1>
        <p class="hero__profile" v-if="restaurantProfile">{{ restaurantProfile }}</p>
        <p class="hero__desc" v-if="restaurantDescription">{{ restaurantDescription }}</p>
      </div>
    </header>

    <!-- Category navigation -->
    <nav class="catnav" v-if="categories.length > 1" :aria-label="copy.sections">
      <div class="catnav__scroll">
        <button
          v-for="cat in categories"
          :key="cat.category_id"
          class="catnav__pill"
          :class="{ 'catnav__pill--on': selectedCategoryId === cat.category_id }"
          :aria-current="selectedCategoryId === cat.category_id ? 'true' : undefined"
          @click="selectCategory(cat.category_id)"
        >
          {{ categoryName(cat) }}
        </button>
      </div>
    </nav>

    <main class="body" ref="bodyEl">
      <div class="wrap">
        <div class="section-intro" v-if="activeCategory">
          <h2 class="section-intro__title">{{ categoryName(activeCategory) }}</h2>
          <p class="section-intro__desc" v-if="categoryDescription(activeCategory)">
            {{ categoryDescription(activeCategory) }}
          </p>
        </div>

        <ul class="dishes" v-if="visibleItems.length">
          <template v-for="(item, idx) in visibleItems" :key="idx">
            <li v-if="item.type === 'divisor'" class="divider">
              <span class="divider__label">{{ productTitle(item) }}</span>
            </li>

            <li v-else class="dish">
              <div class="dish__body">
                <div class="dish__line">
                  <h3 class="dish__name">{{ productTitle(item) }}</h3>
                  <span class="dish__leader" aria-hidden="true"></span>
                  <span class="dish__price" v-if="productPrice(item)">
                    {{ productPrice(item) }}<span class="dish__cur">{{ currency }}</span>
                    <small class="dish__suffix" v-if="productPriceSuffix(item)">
                      {{ productPriceSuffix(item) }}
                    </small>
                  </span>
                </div>

                <p class="dish__desc" v-if="productDescription(item)">{{ productDescription(item) }}</p>

                <ul class="tags" v-if="productAllergens(item).length">
                  <li v-for="a in productAllergens(item)" :key="a.id" class="tags__tag">{{ a.name }}</li>
                </ul>
              </div>

              <!-- A button, not a bare img: the photo is worth opening, and a
                   thumbnail crop hides most of it. -->
              <button v-if="productPhoto(item)" type="button" class="dish__photo-btn"
                      :aria-label="`${copy.enlarge}: ${productTitle(item)}`" @click="openPhoto(item)">
                <img :src="productPhoto(item)" class="dish__photo" alt="" loading="lazy" decoding="async">
              </button>
            </li>
          </template>
        </ul>

        <p class="empty" v-else>{{ copy.empty }}</p>

        <footer class="foot">
          <div v-if="hasContact" class="foot__contact">
            <h4 class="foot__title">{{ copy.contactTitle }}</h4>
            <address class="contact-list">
              <span v-if="contact.address" class="contact-list__item">{{ contact.address }}</span>
              <a v-if="contact.phone" class="contact-list__item" :href="phoneHref">{{ contact.phone }}</a>
              <a v-if="contact.email" class="contact-list__item" :href="`mailto:${contact.email}`">{{ contact.email }}</a>
              <a v-if="contact.website" class="contact-list__item" :href="websiteHref" target="_blank" rel="noreferrer">{{ websiteLabel }}</a>
              <a v-if="contact.instagram" class="contact-list__item" :href="instagramHref" target="_blank" rel="noreferrer">@{{ instagramHandle }}</a>
            </address>
          </div>
          <div class="foot__notice">
            <h4 class="foot__title">{{ copy.allergenTitle }}</h4>
            <p class="foot__text">{{ copy.allergenText }}</p>
          </div>
          <p class="foot__brand">Powered by <strong>FoodBoard</strong></p>
        </footer>
      </div>
    </main>
   </div>

    <PhotoLightbox :src="photo.src" :title="photo.title"
                   :enlarge-label="copy.enlarge" :close-label="copy.close"
                   @close="closePhoto" />
  </div>

  <div v-else-if="loading" class="state">
    <div class="state__spinner" role="status" aria-label="Loading"></div>
  </div>

  <div v-else class="state">
    <h2 class="state__title">{{ copy.notFoundTitle }}</h2>
    <p class="state__text">{{ copy.notFoundText }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { fetchPublicMenu } from '../api/structures.js'
import PhotoLightbox from '../components/PhotoLightbox.vue'
import { descriptorImage, mediaUrl } from '../media.js'
import { fieldValue, tabFor as resolveTab } from '../menuTranslations.js'
import { menuPageMeta, resetPageMeta, resetPageLanguage, setPageLanguage, setPageMeta } from '../pageMeta.js'
import LanguagePicker from '../components/LanguagePicker.vue'

const route = useRoute()
const loading = ref(true)

const structure = ref(null)
const structureData = ref(null)
const lists = ref([])
const activeList = ref(null)
const menuIsActive = ref(false)
const categories = ref([])
const productsMap = ref({})

const currentLang = ref('it')
const selectedCategoryId = ref(null)
const bodyEl = ref(null)

const ALLERGENS = {
  '1':  { icon: '🦪', it: 'Molluschi',        en: 'Molluscs',    ro: 'Moluște' },
  '2':  { icon: '🐟', it: 'Pesce',            en: 'Fish',        ro: 'Pește' },
  '3':  { icon: '🌱', it: 'Sesamo',           en: 'Sesame',      ro: 'Susan' },
  '4':  { icon: '🫘', it: 'Soia',             en: 'Soy',         ro: 'Soia' },
  '5':  { icon: '🦐', it: 'Crostacei',        en: 'Crustaceans', ro: 'Crustacee' },
  '6':  { icon: '🌾', it: 'Glutine',          en: 'Gluten',      ro: 'Gluten' },
  '7':  { icon: '🌼', it: 'Lupini',           en: 'Lupin',       ro: 'Lupin' },
  '8':  { icon: '🥬', it: 'Sedano',           en: 'Celery',      ro: 'Țelină' },
  '9':  { icon: '🍷', it: 'Solfiti',          en: 'Sulphites',   ro: 'Sulfiți' },
  '10': { icon: '🌭', it: 'Senape',           en: 'Mustard',     ro: 'Muștar' },
  '11': { icon: '🥚', it: 'Uova',             en: 'Eggs',        ro: 'Ouă' },
  '12': { icon: '🥜', it: 'Arachidi',         en: 'Peanuts',     ro: 'Arahide' },
  '13': { icon: '🌰', it: 'Frutta a guscio',  en: 'Tree nuts',   ro: 'Nuci' },
  '14': { icon: '🥛', it: 'Latte',            en: 'Milk',        ro: 'Lapte' }
}

/** Customer-facing strings. Kept local: this page is public and must render in
 *  the diner's language, independent of the admin panel's locale setting. */
const COPY = {
  it: {
    language: 'Lingua', sections: 'Sezioni del menù',
    empty: 'Nessun piatto in questa sezione.',
    contactTitle: 'Contatti',
    allergenTitle: 'Allergeni e intolleranze',
    allergenText: 'Per qualsiasi dubbio su intolleranze o allergie alimentari, rivolgetevi al nostro personale di sala.',
    notFoundTitle: 'Menù non trovato',
    notFoundText: 'Il menù richiesto non esiste o non è più attivo.',
    enlarge: 'Ingrandisci la foto', close: 'Chiudi'
  },
  en: {
    language: 'Language', sections: 'Menu sections',
    empty: 'No dishes in this section.',
    contactTitle: 'Contact',
    allergenTitle: 'Allergens & intolerances',
    allergenText: 'If you have any food allergy or intolerance, please speak to a member of our staff.',
    notFoundTitle: 'Menu not found',
    notFoundText: 'This menu does not exist or is no longer active.',
    enlarge: 'Enlarge photo', close: 'Close'
  },
  ro: {
    language: 'Limbă', sections: 'Secțiuni meniu',
    empty: 'Niciun preparat în această secțiune.',
    contactTitle: 'Contact',
    allergenTitle: 'Alergeni și intoleranțe',
    allergenText: 'Dacă aveți alergii sau intoleranțe alimentare, vă rugăm să întrebați personalul nostru.',
    notFoundTitle: 'Meniu negăsit',
    notFoundText: 'Acest meniu nu există sau nu mai este activ.',
    enlarge: 'Mărește fotografia', close: 'Închide'
  }
}

const copy = computed(() => COPY[currentLang.value] || COPY.en)

const fetchData = async () => {
  loading.value = true
  menuIsActive.value = false
  activeList.value = null
  categories.value = []
  productsMap.value = {}
  // The published address is the structure's rotatable slug, never its id.
  const slug = route.params.slug

  try {
    const data = await fetchPublicMenu(slug)
    if (!data?.structure || !data?.list) throw new Error('Menu not found')

    structure.value = data.structure
    structureData.value = data.structure.structure || {}
    currentLang.value = data.structure.structure?.language_main || 'it'
    lists.value = [data.list]
    activeList.value = data.list
    menuIsActive.value = true

    categories.value = data.categories || []
    if (!categories.value.length) return

    selectedCategoryId.value = categories.value[0].category_id
    productsMap.value = data.products || {}
  } catch (err) {
    console.error('Error loading menu:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})

// The tab, a bookmark and Google's index should all name the restaurant, not
// the builder that made the menu.
watchEffect(() => {
  if (loading.value || !menuIsActive.value) return
  setPageMeta(menuPageMeta({
    restaurant: restaurantName.value,
    menu: listTitle.value,
    profile: restaurantProfile.value,
    description: restaurantDescription.value
  }))
})

// The menu is written in the language the diner picked, which is rarely the
// language the dashboard is in. Announce that one while the menu is on screen.
watchEffect(() => setPageLanguage(currentLang.value))

const selectCategory = (categoryId) => {
  selectedCategoryId.value = categoryId
  bodyEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const availableLanguages = computed(() => structureData.value?.languages?.length
  ? structureData.value.languages
  : ['it'])

const languageOptions = computed(() => availableLanguages.value.map(value => ({ value, label: languageName(value) })))

const currency = computed(() => structureData.value?.currency || '€')

// The `title` column always holds the main-language name, so prefer the
// per-language value from the list's descriptor and fall back to the column.
const listTitle = computed(() =>
  fieldValue(tabFor(activeList.value?.editModal?.[0]?.tabs), 'Titolo')
  || activeList.value?.title
  || '')

const activeCategory = computed(() =>
  categories.value.find(c => c.category_id === selectedCategoryId.value) || null)

const visibleItems = computed(() => {
  const items = productsMap.value[selectedCategoryId.value]
  // Honour the canonical status and legacy image status until older records
  // have been edited and re-saved through the corrected dashboard.
  return items ? items.filter(p => p.active !== false && p.image?.active !== false) : []
})

const themeClass = computed(() =>
  structureData.value?.color_theme === 'dark' ? 'menu--dark' : 'menu--light')

const logo = computed(() => mediaUrl(structureData.value?.logo))
const contact = computed(() => structureData.value?.contact || {})
const hasContact = computed(() => Object.values(contact.value).some(Boolean))
const normaliseUrl = (value) => value && /^https?:\/\//i.test(value) ? value : `https://${value || ''}`
const phoneHref = computed(() => `tel:${(contact.value.phone || '').replace(/[^+\d]/g, '')}`)
const websiteHref = computed(() => normaliseUrl(contact.value.website))
const websiteLabel = computed(() => (contact.value.website || '').replace(/^https?:\/\//i, '').replace(/\/$/, ''))
const instagramHandle = computed(() => (contact.value.instagram || '').replace(/^@/, ''))
const instagramHref = computed(() => `https://instagram.com/${instagramHandle.value}`)

/**
 * The brand colour drives the page through a custom property. The background
 * colour set in the admin panel shows around the menu column on wide screens —
 * on a phone the column fills the viewport and covers it.
 */
const pageStyle = computed(() => {
  const s = structureData.value || {}
  const style = { '--accent': s.color_main || '#2f4f43' }
  if (s.color_background) style.backgroundColor = s.color_background
  return style
})

/* Endonyms rather than flag emoji: regional-indicator flags do not render on
 * Windows, and a language is not a country. */
const languageName = (lang) => ({
  it: 'Italiano', en: 'English', ro: 'Română', es: 'Español',
  de: 'Deutsch', fr: 'Français', ru: 'Русский', zh: '中文', ja: '日本語'
}[lang] || lang.toUpperCase())

/* --- Translation lookups ---------------------------------------------
 * The rules live in menuTranslations.js so they can be tested on their own;
 * here they are simply bound to the language the diner has selected. */

const tabFor = (tabs) => resolveTab(tabs, currentLang.value)

const structureField = (label) => {
  const tab = tabFor(structureData.value?.description?.tabs)
  return fieldValue(tab, label)
}

const restaurantName = computed(() =>
  structureField('Nome struttura') || structure.value?.title || '')
const restaurantProfile = computed(() => structureField('Profilo attivita'))
const restaurantDescription = computed(() => structureField('Descrizione'))

const categoryName = (category) =>
  fieldValue(tabFor(category?.editModal?.[0]?.tabs), 'Titolo') || category?.name || ''

const categoryDescription = (category) =>
  fieldValue(tabFor(category?.editModal?.[0]?.tabs), 'Descrizione')

const productTitle = (item) =>
  fieldValue(tabFor(item?.editModal?.[0]?.tabs), 'Titolo') || item?.name || ''

const productDescription = (item) => {
  const tab = tabFor(item?.editModal?.[0]?.tabs)
  const rows = tab?.find(f => f.type === 'description_rows')
  if (rows?.value?.length) {
    return rows.value.map(r => r.value).filter(Boolean).join(' • ')
  }
  return fieldValue(tab, 'Descrizione')
}

const priceField = (item) =>
  tabFor(item?.editModal?.[0]?.tabs)?.find(f => f.type === 'prices')?.value?.[0]

const productPrice = (item) => priceField(item)?.value || ''
const productPriceSuffix = (item) => priceField(item)?.suffix || ''

/** The dish's own picture, empty when unset or switched off by the owner. */
const productPhoto = (item) => descriptorImage(item?.editModal)

/* --- Photo lightbox --- the overlay itself lives in PhotoLightbox.vue --- */

const photo = ref({ src: '', title: '' })

const openPhoto = (item) => {
  const src = productPhoto(item)
  if (src) photo.value = { src, title: productTitle(item) }
}

const closePhoto = () => { photo.value = { src: '', title: '' } }

// Navigating back to the dashboard must not keep the restaurant's title.
onBeforeUnmount(() => {
  resetPageMeta()
  resetPageLanguage()
})

const productAllergens = (item) => {
  const field = item?.editModal?.find(f => f.type === 'allergens')
  if (!Array.isArray(field?.value)) return []
  return field.value.map(id => ({
    id,
    icon: ALLERGENS[id]?.icon || '⚠️',
    name: ALLERGENS[id]?.[currentLang.value] || ALLERGENS[id]?.en || `#${id}`
  }))
}
</script>

<style scoped>
/* Mobile-first: base rules target phones, media queries scale up. */

.menu {
  --ink: #1b1a18;
  --ink-soft: #6b665f;
  --paper: #fbf9f6;
  --card: #ffffff;
  --line: #e7e1d8;
  --radius: 14px;

  min-height: 100vh;
  color: var(--ink);
  font-family: 'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  letter-spacing: 0;
}

.menu--dark {
  --ink: #f2efe9;
  --ink-soft: #a8a29a;
  --paper: #14161a;
  --card: #1c1f24;
  --line: #2c3037;
}

/* The menu itself is a fixed-width sheet; the structure's background colour or
 * image shows around it once the viewport is wider than the sheet. */
.sheet {
  background: var(--paper);
  max-width: 760px;
  margin: 0 auto;
  min-height: 100vh;
}

.wrap {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 20px;
  box-sizing: border-box;
}

/* --- Hero --- */

.hero {
  background: var(--accent);
  color: #fff;
  padding: 18px 0 30px;
}

.hero__inner {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 20px;
  box-sizing: border-box;
}

.hero__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 34px;
  margin-bottom: 22px;
}

.hero__eyebrow {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lang { flex-shrink: 0; }

.hero__logo {
  display: block;
  max-height: 72px;
  max-width: 200px;
  width: auto;
  margin-bottom: var(--s-4, 16px);
  border-radius: 6px;
}

.hero__name {
  font-family: 'Fraunces', Georgia, 'Times New Roman', serif;
  font-size: clamp(2rem, 9vw, 3.1rem);
  font-weight: 600;
  line-height: 1.06;
  letter-spacing: -0.01em;
  margin: 0;
}

.hero__profile {
  margin: 10px 0 0;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.8;
}

.hero__desc {
  margin: 14px 0 0;
  font-size: 0.95rem;
  line-height: 1.55;
  opacity: 0.9;
  max-width: 46ch;
}

/* --- Category navigation --- */

.catnav {
  position: sticky;
  top: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--paper) 92%, transparent);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--line);
}

.catnav__scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 12px 20px;
  max-width: 720px;
  margin: 0 auto;
  box-sizing: border-box;
  scroll-snap-type: x proximity;
}

.catnav__scroll::-webkit-scrollbar { display: none; }

.catnav__pill {
  flex: 0 0 auto;
  scroll-snap-align: start;
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--ink-soft);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 9px 16px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.catnav__pill:hover { color: var(--ink); }

.catnav__pill--on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.catnav__pill:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* --- Body --- */

.body { padding: 30px 0 50px; scroll-margin-top: 60px; }

.section-intro { margin-bottom: 26px; }

.section-intro__title {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.55rem;
  font-weight: 600;
  margin: 0;
}

.section-intro__desc {
  margin: 6px 0 0;
  color: var(--ink-soft);
  font-size: 0.92rem;
  line-height: 1.5;
}

.dishes { list-style: none; margin: 0; padding: 0; }

.divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 34px 0 18px;
}

.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line);
}

.divider:first-child { margin-top: 0; }

.divider__label {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}

.dish {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}

/* min-width:0 lets the leader dots shrink instead of pushing the photo out. */
.dish__body { flex: 1; min-width: 0; }

.dish__photo-btn {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: none;
  line-height: 0;
  border-radius: 12px;
  cursor: zoom-in;
}

.dish__photo-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.dish__photo {
  width: 78px;
  height: 78px;
  object-fit: cover;
  border-radius: 12px;
  background: var(--card);
  border: 1px solid var(--line);
  transition: transform .18s ease;
}

.dish__photo-btn:hover .dish__photo { transform: scale(1.03); }

/* --- Lightbox --- */


.dish:last-child { border-bottom: none; }

/* Classic menu leader: name, dotted rule, price. */
.dish__line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.dish__name {
  font-size: 1.02rem;
  font-weight: 600;
  margin: 0;
  line-height: 1.3;
}

.dish__leader {
  flex: 1;
  min-width: 14px;
  align-self: flex-end;
  margin-bottom: 5px;
  border-bottom: 1px dotted var(--line);
}

.dish__price {
  font-size: 1rem;
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.dish__cur { margin-left: 2px; font-weight: 600; color: var(--ink-soft); }

.dish__suffix {
  display: block;
  text-align: right;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--ink-soft);
  letter-spacing: 0.04em;
  margin-top: 2px;
}

.dish__desc {
  margin: 7px 0 0;
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.55;
  max-width: 58ch;
}

.tags {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 11px 0 0;
  padding: 0;
}

.tags__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ink-soft);
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 3px 9px;
}

.empty {
  color: var(--ink-soft);
  text-align: center;
  padding: 48px 0;
  font-size: 0.95rem;
}

/* --- Footer --- */

.foot { margin-top: 44px; }

.foot__contact {
  margin-bottom: 16px;
  padding: 18px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.contact-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.86rem;
  font-style: normal;
  line-height: 1.5;
}

.contact-list__item { color: inherit; overflow-wrap: anywhere; }
a.contact-list__item { text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 3px; }
a.contact-list__item:hover { color: var(--accent); }

.foot__notice {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px;
}

.foot__title {
  margin: 0 0 6px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
}

.foot__text {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--ink-soft);
}

.foot__brand {
  margin: 20px 0 0;
  text-align: center;
  font-size: 0.78rem;
  color: var(--ink-soft);
}

/* --- Loading / error states --- */

.state {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  background: #fbf9f6;
  color: #1b1a18;
  font-family: 'Figtree', -apple-system, sans-serif;
}

.state__title { font-family: 'Fraunces', Georgia, serif; font-size: 1.5rem; margin: 0; }
.state__text { margin: 0; color: #6b665f; font-size: 0.95rem; }

.state__spinner {
  width: 34px;
  height: 34px;
  border: 3px solid #e7e1d8;
  border-top-color: #2f4f43;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .state__spinner { animation-duration: 2.4s; }
  .catnav__pill { transition: none; }
  .dish__photo { transition: none; }
  .dish__photo-btn:hover .dish__photo { transform: none; }
}

/* --- Larger screens --- */

@media (min-width: 820px) {
  /* Lift the sheet off the background once there is room to see around it. */
  .sheet { box-shadow: 0 10px 50px rgba(0, 0, 0, 0.16); }
}

@media (min-width: 700px) {
  .hero { padding: 24px 0 46px; }
  .hero__bar { margin-bottom: 34px; }
  .hero__desc { font-size: 1.02rem; }
  .body { padding: 40px 0 70px; }
  .section-intro { margin-bottom: 32px; }
  .section-intro__title { font-size: 1.85rem; }
  .dish { padding: 21px 0; gap: 18px; }
  .dish__name { font-size: 1.1rem; }
  .dish__photo { width: 104px; height: 104px; }
  .foot__notice { padding: 22px 24px; }
}
</style>
