<template>
  <section class="workspace-shell">
    <div class="container workspace-shell__inner">
      <div class="workspace-context">
        <details class="structure-picker">
          <summary class="structure-picker__trigger">
            <span class="structure-picker__label">My menus</span>
            <strong>{{ store.selectedStructure?.title }}</strong>
            <font-awesome-icon icon="fa-solid fa-angle-down" aria-hidden="true" />
          </summary>
          <div class="structure-picker__menu">
            <button v-for="(structure, index) in store.structures" :key="structure.structure_id" type="button"
                    :class="{ 'is-current': structure.structure_id === store.selectedStructure?.structure_id }"
                    @click="switchStructure(index)">
              {{ structure.title }}
            </button>
          </div>
        </details>

        <nav class="workspace-nav" :aria-label="$t('settings')">
          <router-link :to="listsRoute" :class="{ 'is-active': route.path === '/lists' || route.path === '/categories' }">
            {{ $t('lists') }}
          </router-link>
          <router-link :to="settingsRoute" :class="{ 'is-active': route.path === '/structures' }">
            {{ $t('settings') }}
          </router-link>
        </nav>

        <div class="workspace-actions">
          <button type="button" class="btn btn-primary" :disabled="creating" @click="createMenu">
            {{ creating ? 'Creating…' : 'Add menu' }}
          </button>
          <button type="button" class="btn btn-quiet" @click="store.isQrOpen = true">QR</button>
          <button type="button" class="btn btn-quiet" @click="openWebPreview">
            {{ $t('preview') }}
            <font-awesome-icon icon="fa-solid fa-angle-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <QrModal :open="store.isQrOpen" @close="store.isQrOpen = false" />
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useStore } from '../stores/store.js'
import QrModal from './QrModal.vue'

const store = useStore()
const router = useRouter()
const route = useRoute()
const creating = ref(false)

const settingsRoute = computed(() => ({ path: '/structures', query: { structure_id: store.selectedStructure?.structure_id } }))
const listsRoute = computed(() => ({ path: '/lists', query: { structure_id: store.selectedStructure?.structure_id } }))

// The published address is the rotatable slug, never the structure's id.
const openWebPreview = () => {
  const slug = store.selectedStructure?.public_slug
  if (slug) window.open(`/menu/${slug}`, '_blank', 'noopener')
}

const createMenu = async () => {
  creating.value = true
  try {
    const created = await store.createStructure()
    await router.push({ path: '/structures', query: { structure_id: created.structure_id } })
  } finally {
    creating.value = false
  }
}

const switchStructure = async (index) => {
  await store.switchStructure(index)
  const structureId = store.selectedStructure.structure_id
  if (route.path === '/categories') {
    await store.requestCategories(store.list_id)
    await router.push({ path: '/categories', query: { structure_id: structureId, list_id: store.list_id } })
    return
  }
  await router.push({ path: route.path, query: { structure_id: structureId } })
}
</script>

<style scoped>
.workspace-shell { background: var(--c-surface); border-bottom: 1px solid var(--c-line); }
.workspace-shell__inner { padding-top: var(--s-3); padding-bottom: var(--s-3); }
.workspace-context { display: flex; align-items: center; gap: var(--s-4); min-width: 0; }
.structure-picker { position: relative; min-width: 0; }
.structure-picker__trigger { display: flex; align-items: baseline; gap: var(--s-2); list-style: none; cursor: pointer; }
.structure-picker__trigger::-webkit-details-marker { display: none; }
.structure-picker__label { color: var(--c-ink-3); font-size: .75rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.structure-picker__trigger strong { min-width: 0; overflow: hidden; color: var(--c-ink); font-size: .95rem; text-overflow: ellipsis; white-space: nowrap; }
.structure-picker__trigger svg { color: var(--c-ink-3); font-size: .75rem; transition: transform 180ms ease; }
.structure-picker[open] .structure-picker__trigger svg { transform: rotate(180deg); }
.structure-picker__menu { position: absolute; top: calc(100% + var(--s-2)); left: 0; z-index: var(--z-dropdown); min-width: 240px; padding: var(--s-1); background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--r-md); box-shadow: var(--shadow-sm); }
.structure-picker__menu button { display: block; width: 100%; min-height: 40px; padding: 0 var(--s-3); color: var(--c-ink-2); text-align: left; font: 600 .9rem/1.2 inherit; background: transparent; border: 0; border-radius: var(--r-sm); cursor: pointer; }
.structure-picker__menu button:hover, .structure-picker__menu button.is-current { color: var(--c-ink); background: var(--c-brand-soft); }
.workspace-nav { display: flex; align-items: center; gap: var(--s-1); margin-left: auto; }
.workspace-nav a { min-height: 36px; display: inline-flex; align-items: center; padding: 0 var(--s-3); color: var(--c-ink-2); font-size: .875rem; font-weight: 650; border-radius: var(--r-sm); }
.workspace-nav a:hover { color: var(--c-ink); background: var(--c-line-2); }
.workspace-nav a.is-active { color: var(--c-brand); background: var(--c-brand-soft); }
.workspace-actions { display: flex; align-items: center; gap: var(--s-2); }
@media (max-width: 680px) { .workspace-context { flex-wrap: wrap; gap: var(--s-3); } .structure-picker { flex: 1 1 100%; } .workspace-nav { order: 3; margin-left: 0; } .workspace-actions { margin-left: auto; } }
@media (max-width: 420px) { .workspace-nav { flex: 1 1 auto; } .workspace-nav a { flex: 1; justify-content: center; } .workspace-actions { width: 100%; margin-left: 0; } .workspace-actions .btn { flex: 1; } }
</style>
