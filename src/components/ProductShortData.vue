<template>
  <article class="product-row" :class="{ 'product-row--divider': type === 'divisor' }">
    <button type="button" class="product-row__name" @click="editProduct">{{ name }}</button>
    <span v-if="type === 'divisor'" class="product-row__kind">{{ $t('insert_divisor') }}</span>
    <label v-else class="product-row__status">
      <input type="checkbox" :checked="isActive" @change="toggleActive" />
      <span>{{ isActive ? $t('published') : $t('drafts') }}</span>
    </label>
    <details class="product-menu">
      <summary :aria-label="$t('actions')">•••</summary>
      <div>
        <button type="button" @click="editProduct">{{ $t('edit') }}</button>
        <button type="button" @click="duplicateProduct">{{ $t('duplicate') }}</button>
        <button type="button" class="is-danger" @click="deleteProduct">{{ $t('delete') }}</button>
      </div>
    </details>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const emits = defineEmits(['toggleActive', 'editProduct', 'duplicateProduct', 'deleteProduct'])
const props = defineProps({ type: { type: String, required: true }, product: { type: Object, required: true }, name: { type: String, default: '' } })
const isActive = computed(() => props.product.active ?? props.product.image?.active ?? true)
const toggleActive = () => emits('toggleActive')
const editProduct = () => emits('editProduct', props.type)
const duplicateProduct = () => emits('duplicateProduct')
const deleteProduct = () => emits('deleteProduct')
</script>

<style scoped>
.product-row { display: grid; grid-template-columns: minmax(0, 1fr) auto 32px; gap: var(--s-3); align-items: center; min-height: 56px; padding: var(--s-2) var(--s-4); border-bottom: 1px solid var(--c-line-2); }.product-row:last-child { border-bottom: 0; }.product-row--divider { min-height: 48px; background: var(--c-line-2); }.product-row__name { min-width: 0; padding: 0; overflow-wrap: anywhere; color: var(--c-ink); text-align: left; font: 600 .92rem/1.35 inherit; background: transparent; border: 0; cursor: pointer; }.product-row__name:hover { color: var(--c-brand); }.product-row--divider .product-row__name { color: var(--c-ink-2); font-weight: 750; }.product-row__kind { color: var(--c-ink-3); font-size: .75rem; }.product-row__status { display: inline-flex; align-items: center; gap: var(--s-1); color: var(--c-ink-3); font-size: .75rem; font-weight: 650; cursor: pointer; }.product-row__status input { width: 15px; height: 15px; accent-color: var(--c-brand); }.product-menu { position: relative; }.product-menu summary { display: grid; place-items: center; width: 32px; height: 32px; list-style: none; color: var(--c-ink-2); letter-spacing: 1px; border-radius: var(--r-sm); cursor: pointer; }.product-menu summary::-webkit-details-marker { display: none; }.product-menu summary:hover { color: var(--c-ink); background: var(--c-line-2); }.product-menu > div { position: absolute; top: calc(100% + var(--s-1)); right: 0; z-index: var(--z-dropdown); display: grid; min-width: 160px; padding: var(--s-1); background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--r-md); box-shadow: var(--shadow-sm); }.product-menu button { min-height: 36px; padding: 0 var(--s-2); color: var(--c-ink-2); text-align: left; font: 600 .85rem/1 inherit; background: transparent; border: 0; border-radius: var(--r-sm); cursor: pointer; }.product-menu button:hover { color: var(--c-ink); background: var(--c-line-2); }.product-menu .is-danger { color: var(--c-danger); }.product-menu .is-danger:hover { color: var(--c-danger); background: var(--c-danger-soft); }@media (max-width: 520px) { .product-row { grid-template-columns: minmax(0, 1fr) 32px; }.product-row__status, .product-row__kind { grid-column: 1; grid-row: 2; }.product-menu { grid-column: 2; grid-row: 1 / span 2; } }
</style>
