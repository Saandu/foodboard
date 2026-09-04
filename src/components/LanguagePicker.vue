<template>
  <details ref="picker" class="language-picker" :class="{ 'language-picker--inverse': inverse }" @keydown.esc="close">
    <summary :aria-label="label">
      <span>{{ selectedLabel }}</span>
      <svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </summary>
    <div class="language-picker__options" role="listbox" :aria-label="label">
      <button v-for="option in options" :key="option.value" type="button" role="option" :aria-selected="option.value === modelValue" @click="select(option.value)">
        <span>{{ option.label }}</span>
        <svg v-if="option.value === modelValue" viewBox="0 0 14 10" aria-hidden="true"><path d="M1 5l3.5 3.5L13 1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    </div>
  </details>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true },
  label: { type: String, required: true },
  inverse: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])
const picker = ref(null)
const selectedLabel = computed(() => props.options.find(option => option.value === props.modelValue)?.label || props.modelValue.toUpperCase())
const close = () => { if (picker.value) picker.value.open = false }
const select = (value) => { emit('update:modelValue', value); close() }
</script>

<style scoped>
.language-picker { --picker-ink: var(--c-ink); --picker-ink-muted: var(--c-ink-2); --picker-surface: var(--c-surface); --picker-line: var(--c-line-strong); position: relative; flex-shrink: 0; }.language-picker summary { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); min-width: 132px; min-height: 38px; padding: 0 var(--s-3); color: var(--picker-ink); font: 650 .875rem/1 inherit; list-style: none; background: var(--picker-surface); border: 1px solid var(--picker-line); border-radius: var(--r-sm); cursor: pointer; transition: border-color 180ms ease, background-color 180ms ease; }.language-picker summary::-webkit-details-marker { display: none; }.language-picker summary:hover { border-color: var(--picker-ink-muted); }.language-picker summary svg { width: 10px; transition: transform 180ms ease; }.language-picker[open] summary { border-color: var(--c-brand); }.language-picker[open] summary svg { transform: rotate(180deg); }.language-picker__options { position: absolute; top: calc(100% + 6px); right: 0; z-index: var(--z-dropdown); width: max(100%, 168px); padding: var(--s-1); background: var(--picker-surface); border: 1px solid var(--picker-line); border-radius: var(--r-sm); box-shadow: var(--shadow-sm); }.language-picker__options button { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 38px; padding: 0 var(--s-2); color: var(--picker-ink-muted); text-align: left; font: 600 .875rem/1 inherit; background: transparent; border: 0; border-radius: 4px; cursor: pointer; }.language-picker__options button:hover, .language-picker__options button[aria-selected="true"] { color: var(--picker-ink); background: var(--c-brand-soft); }.language-picker__options button svg { width: 13px; color: var(--c-brand); }.language-picker--inverse { --picker-ink: #fff; --picker-ink-muted: rgba(255, 255, 255, .72); --picker-surface: #16201c; --picker-line: rgba(255, 255, 255, .32); }.language-picker--inverse summary:hover { background: rgba(255, 255, 255, .08); border-color: rgba(255, 255, 255, .6); }.language-picker--inverse[open] summary { border-color: var(--c-accent); }.language-picker--inverse .language-picker__options { --picker-ink: var(--c-ink); --picker-ink-muted: var(--c-ink-2); --picker-surface: var(--c-surface); --picker-line: var(--c-line-strong); }.language-picker:focus-within summary { outline: 2px solid var(--c-brand); outline-offset: 2px; }.language-picker--inverse:focus-within summary { outline-color: var(--c-accent); } @media (max-width: 420px) { .language-picker summary { min-width: 118px; } }
</style>
