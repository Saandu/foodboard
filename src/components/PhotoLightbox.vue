<template>
  <div v-if="src" ref="dialog" class="lightbox" role="dialog" aria-modal="true" tabindex="-1"
       :aria-label="title || enlargeLabel" @click.self="close">
    <button type="button" class="lightbox__close"
            :aria-label="closeLabel" @click="close">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
    <figure class="lightbox__figure" @click.stop>
      <img :src="src" :alt="title" class="lightbox__img">
      <figcaption v-if="title" class="lightbox__caption">{{ title }}</figcaption>
    </figure>
  </div>
</template>

<script setup>
/**
 * Full-size view of a dish photo.
 *
 * A thumbnail has to be cropped square to keep the price column aligned,
 * which hides most of a wide photo. Tapping it shows the whole thing.
 *
 * The component owns the parts that are easy to get wrong and easy to forget
 * to undo: the scroll lock on the page behind, focus moving to the close
 * button and back to whatever opened it, and the Escape handler. All of it is
 * released on unmount, so leaving the route with the overlay open cannot
 * strand the page in a scroll-locked state.
 */
import { ref } from 'vue'
import { useDialogFocus } from '../useDialogFocus.js'

const props = defineProps({
  /** Image URL; an empty string keeps the overlay closed. */
  src: { type: String, default: '' },
  title: { type: String, default: '' },
  enlargeLabel: { type: String, default: 'Enlarge photo' },
  closeLabel: { type: String, default: 'Close' }
})

const emit = defineEmits(['close'])

const dialog = ref(null)

const close = () => emit('close')
useDialogFocus({ isOpen: () => Boolean(props.src), dialog, onClose: close })
</script>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(10, 12, 11, 0.88);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.lightbox__figure {
  display: grid;
  justify-items: center;
  gap: 12px;
  margin: 0;
  max-width: 100%;
}

.lightbox__img {
  display: block;
  max-width: min(92vw, 1100px);
  max-height: 82vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 10px;
  background: #fff;
}

.lightbox__caption {
  color: #f4f2ee;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
  text-wrap: balance;
}

.lightbox__close {
  position: absolute;
  top: 14px;
  right: 14px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.lightbox__close:hover { background: rgba(255, 255, 255, 0.26); }
.lightbox__close:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.lightbox__close svg { width: 22px; height: 22px; }
</style>
