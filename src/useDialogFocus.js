import { nextTick, onBeforeUnmount, watch } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export const focusableElements = (container) =>
  container ? [...container.querySelectorAll(FOCUSABLE)] : []

/**
 * Gives every modal the same keyboard contract: focus enters the dialog,
 * Tab stays inside it, Escape closes it, background scrolling is locked, and
 * focus returns to the control that opened it.
 */
export function useDialogFocus ({ isOpen, dialog, onClose, canClose = () => true }) {
  let active = false
  let lastFocused = null
  let previousOverflow = ''

  const stop = () => {
    if (!active) return
    active = false
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = previousOverflow
    lastFocused?.focus?.()
    lastFocused = null
  }

  const onKeydown = (event) => {
    if (!active) return

    if (event.key === 'Escape' && canClose()) {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return
    const items = focusableElements(dialog.value)
    if (!items.length) {
      event.preventDefault()
      dialog.value?.focus()
      return
    }

    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && (document.activeElement === first || !dialog.value?.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.value?.contains(document.activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(isOpen, async (open) => {
    if (!open) {
      stop()
      return
    }

    if (!active) {
      active = true
      lastFocused = document.activeElement
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', onKeydown)
    }

    await nextTick()
    if (!isOpen()) return
    const first = focusableElements(dialog.value)[0]
    ;(first || dialog.value)?.focus()
  }, { immediate: true })

  onBeforeUnmount(stop)
}
