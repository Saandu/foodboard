<template>
  <!--
    Live preview of how the published menu will look with the currently
    selected colours and theme. Replaces a 1MB static screenshot, and unlike
    that screenshot it actually reflects the admin's choices.
  -->
  <figure class="preview">
    <svg class="preview__phone" viewBox="0 0 220 440" role="img" :aria-label="$t('preview')">
      <rect x="1" y="1" width="218" height="438" rx="30" fill="#1b1d1c" />
      <rect x="9" y="9" width="202" height="422" rx="24" :fill="paper" />

      <!-- Hero -->
      <path d="M9 33a24 24 0 0 1 24-24h154a24 24 0 0 1 24 24v96H9z" :fill="brand" />
      <rect x="86" y="17" width="48" height="5" rx="2.5" fill="#1b1d1c" opacity="0.55" />
      <rect x="26" y="52" width="104" height="15" rx="4" fill="#ffffff" opacity="0.95" />
      <rect x="26" y="76" width="68" height="7" rx="3.5" fill="#ffffff" opacity="0.6" />
      <rect x="26" y="94" width="140" height="6" rx="3" fill="#ffffff" opacity="0.4" />
      <rect x="26" y="106" width="112" height="6" rx="3" fill="#ffffff" opacity="0.4" />

      <!-- Category pills -->
      <rect x="26" y="146" width="52" height="18" rx="9" :fill="brand" />
      <rect x="84" y="146" width="46" height="18" rx="9" :fill="line" />
      <rect x="136" y="146" width="46" height="18" rx="9" :fill="line" />

      <!-- Dishes -->
      <g v-for="(row, i) in [0, 1, 2, 3]" :key="i">
        <rect x="26" :y="192 + i * 56" width="86" height="9" rx="4.5" :fill="ink" />
        <rect x="158" :y="192 + i * 56" width="26" height="9" rx="4.5" :fill="brand" />
        <rect x="26" :y="208 + i * 56" width="140" height="6" rx="3" :fill="inkSoft" />
        <rect x="26" :y="220 + i * 56" width="104" height="6" rx="3" :fill="inkSoft" />
        <rect x="26" :y="234 + i * 56" width="1" height="1" :fill="line" />
        <rect x="26" :y="238 + i * 56" width="158" height="1" :fill="line" />
      </g>
    </svg>
  </figure>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  colorMain: { type: String, default: '#2f4f43' },
  theme: { type: String, default: 'light' }
})

const isDark = computed(() => props.theme === 'dark')

const brand = computed(() => props.colorMain || '#2f4f43')
const paper = computed(() => (isDark.value ? '#14161a' : '#fbf9f6'))
const ink = computed(() => (isDark.value ? '#f2efe9' : '#1b1a18'))
const inkSoft = computed(() => (isDark.value ? '#5b6068' : '#d8d2c8'))
const line = computed(() => (isDark.value ? '#2c3037' : '#e7e1d8'))
</script>

<style scoped>
.preview {
  margin: 0;
  display: flex;
  justify-content: center;
}

.preview__phone {
  width: 100%;
  max-width: 200px;
  height: auto;
  filter: drop-shadow(0 12px 28px rgba(16, 24, 20, 0.18));
}
</style>
