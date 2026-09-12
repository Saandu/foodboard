// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { useDialogFocus } from '../src/useDialogFocus.js'

const Harness = defineComponent({
  props: { open: Boolean },
  emits: ['close'],
  setup (props, { emit }) {
    const dialog = ref(null)
    useDialogFocus({
      isOpen: () => props.open,
      dialog,
      onClose: () => emit('close')
    })
    return { dialog }
  },
  template: `
    <section v-if="open" ref="dialog" tabindex="-1">
      <button id="first">First</button>
      <button id="last">Last</button>
    </section>
  `
})

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('dialog keyboard behaviour', () => {
  it('moves focus in, traps Tab, closes on Escape, and restores focus', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const wrapper = mount(Harness, { attachTo: document.body, props: { open: false } })
    await wrapper.setProps({ open: true })
    await nextTick()

    expect(document.activeElement?.id).toBe('first')
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.get('#last').element.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement?.id).toBe('first')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.setProps({ open: false })
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })
})
