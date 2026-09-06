// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

/**
 * "Delete account" is hidden for the shared demo account.
 *
 * This is the presentation half of the guard — the half that stops an ordinary
 * visitor rather than a determined one. The half that actually enforces it is
 * delete_account() in migration 20260906000000, asserted for real in
 * tests/rls.test.js by calling the RPC and expecting a refusal. Both halves are
 * worth having: this one means nobody reaches the destructive path by accident.
 */

vi.mock('../src/supabase.js', () => ({ supabase: { auth: { signOut: vi.fn() } } }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../src/demo.js', () => ({
  isDemoUser: (email) => email === 'demo@foodboard.app'
}))

const store = {
  isHeaderLoaded: true,
  user: { user_id: 'u1', email: '', name: 'Ada', surname: 'L' },
  selectedStructure: { structure_id: '111' }
}
vi.mock('../src/stores/store.js', () => ({ useStore: () => store }))

const { default: TheMainHeader } = await import('../src/components/TheMainHeader.vue')

const mountHeader = (email) => {
  store.user = { ...store.user, email }
  return mount(TheMainHeader, {
    global: {
      mocks: { $t: (key) => key, $i18n: { locale: 'en' } },
      stubs: { LanguagePicker: true, DeleteAccountModal: true }
    }
  })
}

describe('the account menu', () => {
  it('offers account deletion to a real account', () => {
    expect(mountHeader('owner@restaurant.com').find('.account-menu__delete').exists()).toBe(true)
  })

  it('hides account deletion from the shared demo account', () => {
    expect(mountHeader('demo@foodboard.app').find('.account-menu__delete').exists()).toBe(false)
  })

  it('still offers logout to the demo account — leaving is not destroying', () => {
    expect(mountHeader('demo@foodboard.app').find('.account-menu__logout').exists()).toBe(true)
  })
})
