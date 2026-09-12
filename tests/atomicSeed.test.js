import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const seed = readFileSync(new URL('../scripts/seed.js', import.meta.url), 'utf8')
const migration = readFileSync(
  new URL('../supabase/migrations/20260911235300_atomic_showcase_reset.sql', import.meta.url),
  'utf8'
)

describe('atomic showcase reset', () => {
  it('sends the complete replacement through one retryable RPC', () => {
    expect(seed).toContain("supabase.rpc('reset_showcase'")
    expect(seed).not.toMatch(/supabase\.from\([^)]*\)\.delete/)
    expect(seed).not.toMatch(/supabase\.from\([^)]*\)\.insert/)
  })

  it('keeps the reset private to the service role and validates row ownership', () => {
    expect(migration).toContain('security invoker')
    expect(migration).toContain('showcase payload contains rows owned by another account')
    expect(migration).toMatch(/revoke all on function public\.reset_showcase[\s\S]*from public, anon, authenticated;/)
    expect(migration).toMatch(/grant execute on function public\.reset_showcase[\s\S]*to service_role;/)
  })
})
