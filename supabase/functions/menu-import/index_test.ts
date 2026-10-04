import assert from 'node:assert/strict'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'

const owner = '11111111-1111-4111-8111-111111111111'
const draft = { title: 'Lunch', language: 'en', currency: 'EUR', warnings: [], categories: [{ name: 'Main courses', description: '', items: [{ name: 'Pasta', description: '', prices: [{ amount: '12.50', label: '' }], allergens: [6], warning: '' }] }] }
for (const [name, value] of Object.entries({ SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key', GEMINI_API_KEY: 'fake-gemini-key', MENU_IMPORT_ENABLED: 'true', MENU_IMPORT_ORIGINS: 'https://foodboard.test' })) Deno.env.set(name, value)
let handler: (request: Request) => Promise<Response>
Object.defineProperty(Deno, 'serve', { value: (callback: typeof handler) => { handler = callback } })
let scenario = ''
let providerCalls = 0
let reservationCalls = 0
let capturedSave: any
globalThis.fetch = async (input: string | URL | Request, options?: RequestInit) => {
  const url = String(input)
  let result: any
  let status = 200
  if (url.includes('/auth/v1/user')) {
    if (scenario === 'invalid-session') { status = 401; result = { message: 'Invalid JWT' } }
    else result = { id: owner, email: 'owner@example.test', email_confirmed_at: '2026-01-01', is_anonymous: scenario === 'anonymous' }
  } else if (url.includes('/rest/v1/structures')) result = scenario === 'not-owner' ? null : { structure_id: 'restaurant' }
  else if (url.includes('/rest/v1/protected_accounts')) result = scenario === 'demo' ? { user_id: owner } : null
  else if (url.includes('/rpc/reserve_menu_import')) {
    reservationCalls++
    if (scenario === 'quota') { status = 400; result = { message: 'import_limit_reached' } } else result = null
  } else if (url.includes('/rpc/save_imported_menu')) {
    capturedSave = JSON.parse(String(options?.body))
    result = { list_id: capturedSave.p_records.list.list_id }
  } else if (url.includes('/menu_import_attempts')) result = null
  else if (url.includes('generativelanguage.googleapis.com')) {
    providerCalls++
    const payload = JSON.parse(String(options?.body))
    assert.equal(new Headers(options?.headers).get('x-goog-api-key'), 'fake-gemini-key')
    assert.equal(payload.contents[0].parts[1].inlineData.mimeType, 'application/pdf')
    assert.equal(payload.generationConfig.responseMimeType, 'application/json')
    if (scenario === 'provider-quota') { status = 429; result = {} }
    else result = { candidates: [{ finishReason: scenario === 'truncated' ? 'MAX_TOKENS' : 'STOP', content: { parts: [{ text: JSON.stringify(draft) }] } }], usageMetadata: { totalTokenCount: 100 } }
  } else throw new Error(`Unexpected mock request: ${url}`)
  return new Response(JSON.stringify(result), { status, headers: { 'content-type': 'application/json' } })
}
await import('./index.ts')

const request = (body: BodyInit | Uint8Array, action = 'extract', authenticated = true) => new Request('https://supabase.test/functions/v1/menu-import', {
  method: 'POST', body: body instanceof Uint8Array ? Uint8Array.from(body).buffer : body,
  headers: { origin: 'https://foodboard.test', ...(authenticated ? { authorization: 'Bearer user-session' } : {}), 'x-structure-id': 'restaurant', 'x-import-action': action, 'x-import-id': '33333333-3333-4333-8333-333333333333' }
})
const reset = (value = '') => { scenario = value; providerCalls = 0; reservationCalls = 0; capturedSave = null }
const pdf = await PDFDocument.create()
pdf.addPage()
const bytes = await pdf.save()

Deno.test('auth and ownership rejection spend no provider quota', async () => {
  for (const state of ['invalid-session', 'anonymous', 'not-owner']) {
    reset(state)
    const response = await handler(request(bytes))
    assert.ok([401, 403].includes(response.status))
    assert.equal(providerCalls, 0)
    assert.equal(reservationCalls, 0)
  }
  reset()
  assert.equal((await handler(request(bytes, 'extract', false))).status, 401)
})
Deno.test('invalid files and overlong PDFs are rejected before quota reservation', async () => {
  reset()
  assert.equal((await handler(request('not a file'))).status, 400)
  const large = await PDFDocument.create()
  for (let index = 0; index < 6; index++) large.addPage()
  assert.deepEqual(await (await handler(request(await large.save()))).json(), { error: 'too_many_pages' })
  assert.equal(providerCalls, 0)
  assert.equal(reservationCalls, 0)
})
Deno.test('quota reservation prevents the provider call; provider quota stays recoverable', async () => {
  reset('quota')
  assert.equal((await handler(request(bytes))).status, 429)
  assert.equal(providerCalls, 0)
  reset('provider-quota')
  assert.deepEqual(await (await handler(request(bytes))).json(), { error: 'provider_limit_reached' })
  assert.equal(providerCalls, 1)
})
Deno.test('direct PDF extraction returns validated JSON and rejects truncated responses', async () => {
  reset()
  const response = await handler(request(bytes))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).draft, draft)
  assert.equal(providerCalls, 1)
  assert.equal(reservationCalls, 1)
  reset('truncated')
  assert.deepEqual(await (await handler(request(bytes))).json(), { error: 'extraction_incomplete' })
})
Deno.test('save regenerates ownership and draft metadata, with deterministic retry IDs', async () => {
  reset()
  const edited = { ...draft, user_id: 'attacker', is_active: true }
  const first = await handler(request(JSON.stringify(edited), 'save'))
  const second = await handler(request(JSON.stringify(edited), 'save'))
  assert.deepEqual(await first.json(), await second.json())
  assert.equal(capturedSave.p_user_id, owner)
  assert.equal(capturedSave.p_records.list.user_id, owner)
  assert.equal(capturedSave.p_records.list.is_active, false)
  assert.equal(providerCalls, 0)
})

Deno.test('save rejects missing prices and currency mismatches independently of the browser', async () => {
  reset()
  const missing = JSON.parse(JSON.stringify(draft))
  missing.categories[0].items[0].prices[0].amount = ''
  assert.deepEqual(await (await handler(request(JSON.stringify(missing), 'save'))).json(), { error: 'invalid_prices' })
  assert.deepEqual(await (await handler(request(JSON.stringify({ ...draft, currency: 'USD' }), 'save'))).json(), { error: 'currency_mismatch' })
  assert.equal(capturedSave, null)
})

Deno.test('shared-demo owners can extract and save with normal quota enforcement', async () => {
  reset('demo')
  assert.equal((await handler(request(bytes))).status, 200)
  assert.equal(providerCalls, 1)
  assert.equal(reservationCalls, 1)
  assert.equal((await handler(request(JSON.stringify(draft), 'save'))).status, 200)
})
