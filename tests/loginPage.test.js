// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'

/**
 * The sign-in page's demo panel.
 *
 * The point of the panel is that a reviewer never has to sign up, so what
 * matters is that it appears on the sign-in route, stays off the register and
 * forgot-password routes, and signs in with the configured credentials when
 * pressed. demo.js is stubbed rather than driven through import.meta.env —
 * tests/demo.test.js covers that half; this covers the wiring.
 */

const signInWithPassword = vi.fn()
const push = vi.fn()
let currentPath = '/login'

vi.mock('../src/supabase.js', () => ({
  supabase: { auth: { signInWithPassword: (...args) => signInWithPassword(...args) } }
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: currentPath, query: {} }),
  useRouter: () => ({ push })
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key) => key }) }))

vi.mock('../src/demo.js', () => ({
  DEMO_EMAIL: 'demo@foodboard.app',
  DEMO_PASSWORD: 'a-published-password',
  isDemoConfigured: true,
  isDemoUser: (email) => email === 'demo@foodboard.app'
}))

const ensureSession = vi.fn()
const clearSession = vi.fn()
vi.mock('../src/stores/store.js', () => ({
  useStore: () => ({ ensureSession, clearSession })
}))

const { default: LoginPage } = await import('../src/views/LoginPage.vue')

const mountPage = () => mount(LoginPage, {
  global: {
    plugins: [createPinia()],
    mocks: { $t: (key) => key, $i18n: { locale: 'en' } },
    stubs: { RouterLink: true, LanguagePicker: true }
  }
})

beforeEach(() => {
  currentPath = '/login'
  signInWithPassword.mockReset().mockResolvedValue({ error: null })
  push.mockReset()
  ensureSession.mockReset()
  clearSession.mockReset()
})

describe('the demo panel', () => {
  it('is offered on the sign-in route', () => {
    expect(mountPage().find('.auth-demo').exists()).toBe(true)
  })

  it('is not offered while registering — there is nothing to demo about signing up', () => {
    currentPath = '/register'
    expect(mountPage().find('.auth-demo').exists()).toBe(false)
  })

  it('is not offered on the forgot-password route', () => {
    currentPath = '/forgot-password'
    expect(mountPage().find('.auth-demo').exists()).toBe(false)
  })
})

describe('entering the demo', () => {
  it('signs in with the configured credentials and opens the workspace', async () => {
    const wrapper = mountPage()
    await wrapper.find('.auth-demo__btn').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'demo@foodboard.app',
      password: 'a-published-password'
    })
    expect(push).toHaveBeenCalledWith('/structures')
  })

  it('surfaces the reason and stays put when the sign-in is refused', async () => {
    signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') })
    const wrapper = mountPage()

    await wrapper.find('.auth-demo__btn').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(push).not.toHaveBeenCalled()
    expect(wrapper.find('.auth-message--error').text()).toBe('Invalid login credentials')
  })
})
