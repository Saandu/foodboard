/**
 * The shared demo account.
 *
 * Both values are inlined into the browser bundle, which is the point: anyone
 * may use them, so there is nothing to hide. What that costs is that the
 * account has to be treated as hostile territory — it owns only the showcase
 * restaurants, `isDemoUser` keeps account deletion out of its reach, and the
 * nightly seed rebuilds whatever a visitor changed.
 *
 * Unset variables leave the demo panel hidden rather than rendering a button
 * that signs nobody in, so a fork without these values still builds.
 */

const normaliseEmail = (value) => typeof value === 'string' ? value.trim().toLowerCase() : ''

export const DEMO_EMAIL = normaliseEmail(import.meta.env.VITE_DEMO_EMAIL)
export const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? ''

/** Both halves or neither: an email without a password cannot sign in. */
export const isDemoConfigured = Boolean(DEMO_EMAIL && DEMO_PASSWORD)

/**
 * Whether a signed-in address is the demo account. Case and stray whitespace
 * are normalised on both sides, because this gates a destructive action and
 * `Demo@FoodBoard.app` is the same account.
 */
export const isDemoUser = (email) => isDemoConfigured && normaliseEmail(email) === DEMO_EMAIL
