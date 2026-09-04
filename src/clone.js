import { toRaw } from 'vue'

/**
 * Deep copy of reactive editor data.
 *
 * The editor works on copies: a modal edits a clone of a record so cancelling
 * leaves the original untouched, and duplicating needs an independent tree.
 *
 * `toRaw` first, because these values arrive as Vue reactive proxies and
 * structuredClone should walk the plain data rather than the proxy traps.
 * This replaces the `JSON.parse(JSON.stringify(x))` idiom the codebase used
 * throughout — same result for descriptor data, without serialising to text.
 */
export const clone = (value) => structuredClone(toRaw(value))
