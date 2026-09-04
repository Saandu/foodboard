<template>
  <div v-if="showAlert" class="alert" role="status">
    <div class="alert__body">
      <h5 class="alert__title">{{ $t('demo_notice_title') }}</h5>
      <p class="alert__text">{{ $t('demo_notice_text') }}</p>
    </div>
    <button class="alert__close" :aria-label="$t('close')" @click="closeAlert">
      <font-awesome-icon icon="fa-solid fa-xmark" />
    </button>
  </div>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

const emits = defineEmits(['closeAlert'])
defineProps({
  showAlert: {
    type: Boolean,
    default: false
  }
})
const closeAlert = () => {
  emits('closeAlert')
}
</script>

<style scoped>
.alert {
  margin: var(--s-3) 0 var(--s-4);
  border-radius: var(--r-md);
  color: var(--c-ink);
  background-color: var(--c-brand-soft);
  border: 1px solid #cfe0d4;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
}

.alert__body { min-width: 0; }

.alert__title {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--c-brand);
  margin-bottom: 2px;
}

.alert__text {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--c-ink-2);
}

.alert__close {
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 1.1rem;
  line-height: 1;
  color: var(--c-ink-3);
  cursor: pointer;
  padding: var(--s-1) var(--s-2);
  border-radius: var(--r-sm);
}

.alert__close:hover { color: var(--c-ink); background: rgba(0, 0, 0, 0.05); }

@media (min-width: 640px) {
  .alert { padding: var(--s-4) var(--s-5); }
  .alert__title { font-size: 1rem; }
}
</style>
