import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Minimal .env reader — avoids a runtime dependency just to read four lines.
 * Real environment variables win, so CI needs no file.
 */
export function loadEnv () {
  try {
    const raw = readFileSync(join(here, '..', '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim()
      }
    }
  } catch {
    // No .env file — fall back to real environment variables (CI).
  }
}

/**
 * Reads the project URL and service_role key, exiting with an explanation
 * rather than a stack trace when either is missing.
 */
export function requireServiceCredentials () {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    console.error('Missing VITE_SUPABASE_URL. Copy .env.example to .env and fill it in.')
    process.exit(1)
  }

  if (!serviceKey) {
    console.error(
      'Missing SUPABASE_SERVICE_ROLE_KEY.\n\n' +
      'Row Level Security scopes every table to its owner, so the publishable key\n' +
      'cannot write these rows. Get the service_role key from Supabase\n' +
      '(Project Settings -> API Keys) and add it to .env — see .env.example.'
    )
    process.exit(1)
  }

  return { url, serviceKey }
}
