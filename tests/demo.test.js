import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The demo account is shared and public, so `isDemoUser` is what keeps account
 * deletion out of a visitor's reach. It reads import.meta.env at module load,
 * hence the reset-and-reimport around each case.
 */
const loadDemo = async ({ email, password }) => {
  vi.resetModules()
  vi.stubEnv('VITE_DEMO_EMAIL', email)
  vi.stubEnv('VITE_DEMO_PASSWORD', password)
  return import('../src/demo.js')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isDemoConfigured', () => {
  it('is true only when both halves are present', async () => {
    await expect(loadDemo({ email: 'demo@foodboard.app', password: 'secret' }))
      .resolves.toMatchObject({ isDemoConfigured: true })
  })

  it('is false when the password is missing, so no button offers a sign-in that cannot work', async () => {
    const { isDemoConfigured } = await loadDemo({ email: 'demo@foodboard.app', password: '' })
    expect(isDemoConfigured).toBe(false)
  })

  it('is false when nothing is configured at all', async () => {
    const { isDemoConfigured } = await loadDemo({ email: '', password: '' })
    expect(isDemoConfigured).toBe(false)
  })
})

describe('isDemoUser', () => {
  it('matches the configured address', async () => {
    const { isDemoUser } = await loadDemo({ email: 'demo@foodboard.app', password: 'secret' })
    expect(isDemoUser('demo@foodboard.app')).toBe(true)
  })

  it('ignores case and surrounding whitespace on both sides', async () => {
    const { isDemoUser } = await loadDemo({ email: '  Demo@FoodBoard.app ', password: 'secret' })
    expect(isDemoUser('DEMO@foodboard.APP')).toBe(true)
  })

  it('does not match a real account', async () => {
    const { isDemoUser } = await loadDemo({ email: 'demo@foodboard.app', password: 'secret' })
    expect(isDemoUser('owner@restaurant.com')).toBe(false)
  })

  it('never matches when the demo is unconfigured, so a blank email is not the demo', async () => {
    const { isDemoUser } = await loadDemo({ email: '', password: '' })
    expect(isDemoUser('')).toBe(false)
    expect(isDemoUser(undefined)).toBe(false)
  })
})
