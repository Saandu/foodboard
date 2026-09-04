<template>
  <div class="language-options">
    <label v-for="option in store.allLanguages" :key="option.id" :class="{ 'is-selected': store.selectedStructure.structure.languages.includes(option.id) }">
      <input @change="store.updateSelectedLanguages(option.id)" :id="option.id" type="checkbox" :value="option.id" :checked="store.selectedStructure.structure.languages.includes(option.id)">
      <span>{{ option.name }}</span>
    </label>
  </div>
</template>

<script setup>
import { useStore } from '../stores/store.js'

const store = useStore()
</script>

<style scoped>
.language-options { display: flex; flex-wrap: wrap; gap: var(--s-2); }.language-options label { display: inline-flex; align-items: center; gap: var(--s-2); min-height: 38px; padding: 0 var(--s-3); color: var(--c-ink-2); font-size: .875rem; font-weight: 650; background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-sm); cursor: pointer; }.language-options label.is-selected { color: var(--c-brand); background: var(--c-brand-soft); border-color: var(--c-brand); }.language-options input { width: 15px; height: 15px; accent-color: var(--c-brand); cursor: pointer; }
</style>
