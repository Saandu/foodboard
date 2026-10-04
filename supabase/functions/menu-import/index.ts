import { createClient } from 'npm:@supabase/supabase-js@2.115.0'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'
import { MAX_FILE_BYTES, detectMime, readBoundedBody, MENU_SCHEMA, EXTRACTION_PROMPT, parseGeminiResponse, validateDraft, currencyMatches } from '../_shared/menu-import.js'
import { buildMenuRecords } from '../_shared/menu-records.js'

const env = (name: string) => Deno.env.get(name) || ''
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
const allowedOrigins = env('MENU_IMPORT_ORIGINS').split(',').map(origin => origin.trim()).filter(Boolean)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async request => {
  const origin = request.headers.get('origin') || ''
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-structure-id, x-import-id, x-import-action',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Cache-Control': 'no-store'
  }
  const reply = (status: number, body: unknown) => Response.json(body, { status, headers })
  if (origin && !allowedOrigins.includes(origin)) return reply(403, { error: 'origin_not_allowed' })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
  if (env('MENU_IMPORT_ENABLED') !== 'true') return reply(503, { error: 'import_disabled' })
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply(401, { error: 'not_authenticated' })
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user || user.is_anonymous || !user.email_confirmed_at) return reply(401, { error: 'not_authenticated' })
  const structureId = request.headers.get('x-structure-id') || ''
  const importId = request.headers.get('x-import-id') || ''
  if (!uuid.test(importId) || !structureId || structureId.length > 150) return reply(400, { error: 'invalid_request' })
  const { data: structure, error: ownerError } = await admin.from('structures').select('structure_id, structure').eq('structure_id', structureId).eq('user_id', user.id).maybeSingle()
  if (ownerError) return reply(503, { error: 'save_unavailable' })
  if (!structure) return reply(403, { error: 'not_owner' })
  try {
    const action = request.headers.get('x-import-action')
    if (action === 'save') {
      const body = await readBoundedBody(request, 512 * 1024)
      const draft = validateDraft(JSON.parse(new TextDecoder().decode(body)))
      if (draft.categories.some(category => category.items.some(item => item.prices.some(price => !price.amount)))) throw new Error('invalid_prices')
      if (!currencyMatches(draft.currency, structure.structure?.currency || '€')) throw new Error('currency_mismatch')
      // Deterministic IDs make a lost response safe to retry with the same import id.
      let index = 0
      const records = buildMenuRecords(draft, structureId, user.id, () => `${importId}-${index++}`)
      const { data, error } = await admin.rpc('save_imported_menu', { p_user_id: user.id, p_import_id: importId, p_records: records })
      if (error) throw new Error(error.message.includes('import_conflict') ? 'import_conflict' : 'save_unavailable')
      return reply(200, data)
    }
    if (action !== 'extract') return reply(400, { error: 'invalid_request' })
    const apiKey = env('GEMINI_API_KEY')
    if (!apiKey) return reply(503, { error: 'import_not_configured' })
    const bytes = await readBoundedBody(request, MAX_FILE_BYTES)
    if (!bytes.length) throw new Error('missing_file')
    const mimeType = detectMime(bytes)
    if (mimeType === 'application/pdf') {
      let document
      try { document = await PDFDocument.load(bytes) } catch { throw new Error('invalid_pdf') }
      if (document.getPageCount() > 5) throw new Error('too_many_pages')
    }
    const { error: quotaError } = await admin.rpc('reserve_menu_import', { p_user_id: user.id, p_structure_id: structureId, p_import_id: importId })
    if (quotaError) return reply(429, { error: 'import_limit_reached' })
    let encoded = ''
    for (let offset = 0; offset < bytes.length; offset += 32768) encoded += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
    const model = env('GEMINI_MODEL') || 'gemini-3.5-flash-lite'
    if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw new Error('import_not_configured')
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: EXTRACTION_PROMPT }, { inlineData: { mimeType, data: btoa(encoded) } }] }],
        generationConfig: {
          responseMimeType: 'application/json', responseJsonSchema: MENU_SCHEMA, maxOutputTokens: 20000,
          ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {})
        }
      }),
      signal: AbortSignal.timeout(90000)
    })
    if (!response.ok) {
      let providerError: { status?: string, message?: string } = {}
      try { providerError = (await response.json()).error || {} } catch { /* Non-JSON gateway response. */ }
      const message = providerError.message || ''
      const reason = /api key/i.test(message) ? 'key_rejected'
        : /schema|generationconfig|responsejsonschema|responseformat/i.test(message) ? 'request_schema_rejected'
        : /model.*not found|not found.*model|models\//i.test(message) ? 'model_unavailable'
        : /permission|project|service.*disabled|billing/i.test(message) ? 'project_access'
        : 'provider_rejected'
      // Classify diagnostics without logging provider messages or request data.
      console.error(JSON.stringify({ event: 'menu_import_provider_error', httpStatus: response.status, providerStatus: providerError.status, model, reason }))
      return reply(response.status === 429 ? 429 : 502, { error: response.status === 429 ? 'provider_limit_reached' : 'provider_unavailable' })
    }
    const result = JSON.parse(new TextDecoder().decode(await readBoundedBody(response, 2 * 1024 * 1024)))
    // Only aggregate token accounting is retained. Never log the file, prompt,
    // extracted menu, API key or authorization headers.
    await admin.from('menu_import_attempts').update({ model, usage: result.usageMetadata || {} }).eq('import_id', importId).eq('user_id', user.id)
    return reply(200, { draft: parseGeminiResponse(result) })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const safeCodes = ['invalid_draft', 'invalid_language', 'invalid_prices', 'currency_mismatch', 'invalid_allergens', 'empty_category', 'too_many_items', 'file_too_large', 'missing_file', 'unsupported_file', 'invalid_pdf', 'too_many_pages', 'invalid_extraction', 'extraction_incomplete', 'import_conflict', 'save_unavailable', 'import_not_configured']
    if (safeCodes.includes(code)) return reply(code === 'save_unavailable' ? 503 : 400, { error: code })
    return reply(502, { error: 'provider_unavailable' })
  }
})
