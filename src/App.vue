<template>
  <div v-if="!isPublicPage && appReady">
    <TheMainHeader />
    <PageContentHeader />
  </div>
  <router-view v-if="isPublicPage || appReady" />
  <TheMainFooter v-if="!isPublicPage && appReady" />
</template>

<script setup>
import { computed, onBeforeMount, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStore } from './stores/store.js'
import { useRoute } from 'vue-router'
import { setBaseLanguage } from './pageMeta.js'
import TheMainHeader from './components/TheMainHeader.vue'
import TheMainFooter from './components/TheMainFooter.vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faInfo,
  faAngleRight,
  faAngleLeft,
  faChevronLeft, faCircleArrowDown,
  faCircleArrowUp,
  faAngleDown,
  faCircleInfo, faCircleMinus,
  faUserSecret,
  faXmark,
  faSignal,
  faQrcode,
  faCopy,
  faCheck,
  faDownload,
  faArrowUpRightFromSquare
} from '@fortawesome/free-solid-svg-icons'
import PageContentHeader from './components/PageContentHeader.vue'

library.add(faUserSecret, faInfo, faXmark, faAngleLeft, faAngleRight, faAngleDown, faCircleInfo, faChevronLeft, faCircleArrowUp, faCircleArrowDown, faCircleMinus, faSignal, faQrcode, faCopy, faCheck, faDownload, faArrowUpRightFromSquare)

const store = useStore()
const route = useRoute()

const appReady = ref(false)
const isPublicPage = computed(() => {
  return route.path === '/' || route.path.startsWith('/menu/') || route.path === '/login' || route.path === '/register' || route.path === '/forgot-password' || route.path === '/reset-password'
})

onBeforeMount(async () => {
  // Public pages must not wait on the dashboard bootstrap — a diner opening a
  // menu has no session to load. The router loads the workspace on its way
  // into an authenticated route, so this only covers a direct hit on one.
  if (isPublicPage.value) {
    appReady.value = true
    return
  }
  await store.ensureSession()
  appReady.value = true
})

// Keep <html lang> on the interface locale. A published menu overrides it with
// the language it is written in for as long as it is mounted.
const { locale } = useI18n()
watchEffect(() => setBaseLanguage(locale.value))



</script>

<style scoped>
</style>
