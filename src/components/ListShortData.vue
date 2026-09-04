<template>
  <article v-show="display !== 'none'" class="list-row">
    <button type="button" class="list-row__title" @click="enterList">{{ name }}</button>
    <div class="list-row__meta">
      <span><strong>{{ category }}</strong>{{ $t('sections') }}</span>
      <span><strong>{{ count }}</strong>{{ $t('items') }}</span>
    </div>
    <label class="status-toggle">
      <span class="sr-only">{{ $t('status') }}</span>
      <input type="checkbox" :checked="active" @change="toggleActive" />
      <span aria-hidden="true" class="status-toggle__track"></span>
      <span class="status-toggle__label">{{ active ? $t('published') : $t('drafts') }}</span>
    </label>
    <details class="action-menu">
      <summary :aria-label="$t('actions')">•••</summary>
      <div class="action-menu__content">
        <button type="button" @click="enterList">{{ $t('open') }}</button>
        <button type="button" @click="editList">{{ $t('edit') }}</button>
        <button type="button" @click="duplicateList">{{ $t('duplicate') }}</button>
        <button type="button" class="is-danger" @click="deleteList">{{ $t('delete') }}</button>
      </div>
    </details>
  </article>
</template>

<script setup>
const emits = defineEmits(['toggleActive', 'editList', 'enterList', 'duplicateList', 'deleteList'])
const props = defineProps({
  name: { type: String, default: '' }, count: { type: Number, default: 0 }, category: { type: Number, default: 0 },
  active: { type: Boolean, default: false }, display: { type: String, default: 'block' }
})
const toggleActive = () => emits('toggleActive', !props.active)
const editList = () => emits('editList')
const enterList = () => emits('enterList')
const duplicateList = () => emits('duplicateList')
const deleteList = () => emits('deleteList')
</script>

<style scoped>
.list-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--s-3); align-items: center; padding: var(--s-4) 0; border-bottom: 1px solid var(--c-line); }.list-row__title { min-width: 0; padding: 0; overflow-wrap: anywhere; color: var(--c-ink); text-align: left; font: 700 1rem/1.3 inherit; background: transparent; border: 0; cursor: pointer; }.list-row__title:hover { color: var(--c-brand); }.list-row__meta { display: flex; grid-column: 1 / -1; gap: var(--s-4); order: 3; }.list-row__meta span { display: grid; gap: 1px; color: var(--c-ink-3); font-size: .73rem; }.list-row__meta strong { color: var(--c-ink-2); font-size: .9rem; font-variant-numeric: tabular-nums; }.status-toggle { display: inline-flex; align-items: center; gap: var(--s-2); cursor: pointer; }.status-toggle input { position: absolute; opacity: 0; }.status-toggle__track { position: relative; width: 32px; height: 18px; border-radius: 999px; background: var(--c-line-strong); transition: background .18s ease; }.status-toggle__track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform .18s ease; }.status-toggle input:checked + .status-toggle__track { background: var(--c-brand); }.status-toggle input:checked + .status-toggle__track::after { transform: translateX(14px); }.status-toggle input:focus-visible + .status-toggle__track { outline: 2px solid var(--c-brand); outline-offset: 2px; }.status-toggle__label { color: var(--c-ink-3); font-size: .78rem; font-weight: 650; }.action-menu { position: relative; grid-column: 2; grid-row: 1; }.action-menu summary { display: grid; place-items: center; width: 32px; height: 32px; list-style: none; color: var(--c-ink-2); letter-spacing: 1px; border-radius: var(--r-sm); cursor: pointer; }.action-menu summary::-webkit-details-marker { display: none; }.action-menu summary:hover { color: var(--c-ink); background: var(--c-line-2); }.action-menu__content { position: absolute; top: calc(100% + var(--s-1)); right: 0; z-index: var(--z-dropdown); display: grid; min-width: 160px; padding: var(--s-1); background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--r-md); box-shadow: var(--shadow-sm); }.action-menu__content button { min-height: 36px; padding: 0 var(--s-2); color: var(--c-ink-2); text-align: left; font: 600 .85rem/1 inherit; background: transparent; border: 0; border-radius: var(--r-sm); cursor: pointer; }.action-menu__content button:hover { color: var(--c-ink); background: var(--c-line-2); }.action-menu__content .is-danger { color: var(--c-danger); }.action-menu__content .is-danger:hover { color: var(--c-danger); background: var(--c-danger-soft); }.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (min-width: 680px) { .list-row { grid-template-columns: minmax(0, 1fr) 144px 118px 32px; }.list-row__meta { grid-column: auto; order: initial; justify-content: space-between; gap: var(--s-3); }.action-menu { grid-column: auto; grid-row: auto; } }
</style>
