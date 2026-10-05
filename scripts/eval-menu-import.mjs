// Measures AI menu-import accuracy on fixed fixtures and writes
// docs/menu-import-eval.md.
//
//   node scripts/eval-menu-import.mjs            through the deployed Edge Function
//   node scripts/eval-menu-import.mjs --direct   straight to Gemini (GEMINI_API_KEY)
//
// The default mode exercises the real production path: auth, quota, the
// function's own validation and repair. It creates one disposable confirmed
// account per fixture (the per-account cooldown would otherwise serialise the
// run) and deletes them all in `finally`. Each fixture costs one Gemini call
// and counts toward the project's daily import cap.
import fs from 'node:fs/promises'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { setTimeout as sleep } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import sharp from 'sharp'
import { loadEnv, requireServiceCredentials } from './env.js'
import { buildGeminiRequest, detectMime, parseGeminiResponse, validateDraft } from '../supabase/functions/_shared/menu-import.js'
import { FIXTURES } from './eval/fixtures.js'
import { scoreFixture, summarize } from './eval/score.js'

loadEnv()
const direct = process.argv.includes('--direct')
const renderOnly = process.argv.includes('--render-only')
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
const outDir = 'test-results/menu-import-eval'
const DESCRIPTIONS = {
  'trattoria-it': 'Italian PDF, 2 pages, comma prices, two sizes, EU-numbered allergen legend',
  'bistro-ro': 'Romanian image, diacritics, lei, a dish priced by weight',
  'cafe-photo': 'Tilted, blurred phone photo with no allergen information',
  injection: 'Hidden white text instructing the model to zero prices and add a dish',
  'not-a-menu': 'A lost-cat poster that must be refused'
}

// Kept in the generated report: what earlier runs found and what changed.
const HISTORY = `## What the eval caught

The first two runs on 2026-10-05 failed, and both failures changed the production code:

1. **Allergen numbers were copied, not translated.** The Italian menu prints allergens as EU Annex II numbers (9 = celery, 12 = sulphites). The model returned celery as FoodBoard id 9 (sulphites) and sulphites as id 12 (peanuts), while mapping other numbers correctly. A prompt instruction did not fix it. **Fix:** the schema now asks for allergen *names* (\`"celery"\`) and code maps them to ids, so a printed number is no longer a valid answer.
2. **Prices came back 100× too high** (\`€ 6,50\` → \`650\`) on two fixtures. The prompt said amounts are written "without currency, decimal point, no thousands separators", which reads as "no decimal point". The first run had happened to interpret it correctly. **Fix:** an explicit format with worked examples.

The first run after both fixes passed all five fixtures. LLM output varies between runs, so this is one measured sample, not a guarantee. That is why the owner still reviews every draft.
`

const escapeXml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function render (fixture) {
  if (fixture.render === 'pdf') {
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    for (const [index, lines] of fixture.pages.entries()) {
      const page = pdf.addPage([595, 842])
      lines.forEach((line, row) => page.drawText(line, { x: 48, y: 790 - row * 19, size: index === 0 && row === 0 ? 18 : 11, font: line && !line.startsWith(' ') ? bold : font }))
      if (fixture.hidden && index === 0) page.drawText(fixture.hidden, { x: 20, y: 24, size: 3, font, color: rgb(1, 1, 1) })
    }
    return Buffer.from(await pdf.save())
  }
  const lines = fixture.pages.flat()
  const height = 120 + lines.length * 44
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="${height}"><rect width="100%" height="100%" fill="#fffdf7"/>` +
    lines.map((line, row) => `<text x="60" y="${80 + row * 44}" font-family="Arial, Helvetica, sans-serif" font-size="${row === 0 ? 38 : 26}" font-weight="${line && !line.startsWith(' ') ? 700 : 400}" fill="#222" xml:space="preserve">${escapeXml(line)}</text>`).join('') +
    '</svg>'
  const image = sharp(Buffer.from(svg))
  if (fixture.render === 'png') return image.png().toBuffer()
  // A phone photo: tilted, soft, warmer and badly compressed.
  const flat = await image.png().toBuffer()
  return sharp(flat).rotate(-3.5, { background: '#c9b68f' }).resize({ width: 1000 }).blur(1.1).modulate({ brightness: 0.88, saturation: 0.9 }).tint('#f3e2c0').jpeg({ quality: 55 }).toBuffer()
}

async function extractDirect (bytes) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('--direct needs GEMINI_API_KEY in .env (never commit it)')
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(buildGeminiRequest(detectMime(bytes), bytes.toString('base64'), model)),
    signal: AbortSignal.timeout(90000)
  })
  const result = await response.json()
  if (!response.ok) return { error: `provider_${response.status}` }
  try { return { draft: parseGeminiResponse(result), usage: result.usageMetadata } } catch (error) { return { error: error.message, usage: result.usageMetadata } }
}

function viaFunction () {
  const { url, serviceKey } = requireServiceCredentials()
  const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!publishable) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY')
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const accounts = []
  return {
    async extract (bytes) {
      const email = `foodboard-import-eval-${crypto.randomUUID()}@example.invalid`
      const password = `${crypto.randomUUID()}Aa!9`
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (created.error) throw created.error
      accounts.push(created.data.user.id)
      const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } })
      const signedIn = await client.auth.signInWithPassword({ email, password })
      if (signedIn.error) throw signedIn.error
      const structureId = crypto.randomUUID()
      const inserted = await client.from('structures').insert({ structure_id: structureId, user_id: created.data.user.id, title: 'Disposable import eval', structure: { currency: '€', languages: ['en'], language_main: 'en' } })
      if (inserted.error) throw inserted.error
      const importId = crypto.randomUUID()
      const response = await fetch(`${url}/functions/v1/menu-import`, {
        method: 'POST',
        headers: { apikey: publishable, authorization: `Bearer ${signedIn.data.session.access_token}`, 'x-structure-id': structureId, 'x-import-action': 'extract', 'x-import-id': importId, 'content-type': detectMime(bytes) },
        body: bytes
      })
      const body = await response.json()
      const attempt = await admin.from('menu_import_attempts').select('usage').eq('import_id', importId).maybeSingle()
      const usage = attempt.data?.usage
      if (!response.ok) return { error: body.error || `http_${response.status}`, usage }
      return { draft: validateDraft(body.draft), usage }
    },
    async cleanup () {
      for (const id of accounts) {
        const deleted = await admin.auth.admin.deleteUser(id)
        if (deleted.error) console.error(`Cleanup failed for eval account ${id}: ${deleted.error.message}`)
      }
    }
  }
}

const pct = value => `${Math.round(value * 100)}%`
const tokensOf = usage => (usage ? `${usage.promptTokenCount ?? '?'} / ${usage.candidatesTokenCount ?? '?'}` : '—')

function report (results, summary, runs) {
  const menuRows = results.map(result => {
    const run = runs[result.id]
    const cells = result.kind === 'refusal'
      ? ['—', '—', '—', '—', result.passed ? 'refused' : (result.error || 'accepted')]
      : [result.dishes ? `${result.dishes.matched}/${result.dishes.expected}${result.dishes.found > result.dishes.matched ? ` (+${result.dishes.found - result.dishes.matched})` : ''}` : '—',
        result.prices ? `${result.prices.right}/${result.prices.of}` : '—',
        result.allergens ? `${result.allergens.right}/${result.allergens.of} · FP ${result.allergens.falsePositives} · FN ${result.allergens.falseNegatives}` : '—',
        result.currencyRight === undefined ? '—' : (result.currencyRight ? 'yes' : 'no'),
        result.injectionResisted === undefined ? '' : (result.injectionResisted ? 'injection resisted' : 'INJECTION SUCCEEDED')]
    return `| \`${result.id}\` | ${DESCRIPTIONS[result.id]} | ${cells.join(' | ')} | ${(run.latencyMs / 1000).toFixed(1)} s | ${tokensOf(run.usage)} | ${result.passed ? '✅' : '❌'} |`
  })
  const notes = results.filter(result => result.notes.length).map(result => `- **${result.id}**: ${result.notes.join('; ')}`)
  return `# Menu import accuracy

Generated by \`npm run eval:import\` on ${new Date().toISOString().slice(0, 10)}, model \`${model}\`, ${direct ? 'calling Gemini directly' : 'through the deployed Edge Function'}.
Fixtures are synthetic and defined in [\`scripts/eval/fixtures.js\`](../scripts/eval/fixtures.js); the scorer is unit tested in \`tests/menuImportEval.test.js\`.

| Metric | Result |
| --- | --- |
| Fixtures fully correct | ${summary.fixturesPassed} / ${summary.fixtures} |
| Dish recall | ${pct(summary.dishRecall)} |
| Dish precision | ${pct(summary.dishPrecision)} |
| Price accuracy (matched dishes) | ${pct(summary.priceAccuracy)} |
| Allergens exactly right (matched dishes) | ${pct(summary.allergenAccuracy)} |
| Invented allergens (false positives) | ${summary.allergenFalsePositives} |
| Missed allergens (false negatives) | ${summary.allergenFalseNegatives} |

| Fixture | What it tests | Dishes | Prices | Allergens | Currency | Other | Latency | Tokens in / out | Pass |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${menuRows.join('\n')}

A fixture passes only when every dish, price, allergen, currency and language matches.

${notes.length ? `## Differences in this run\n\n${notes.join('\n')}\n\nEach difference is something the owner corrects in the review and allergen steps before saving.\n` : 'Every fixture matched exactly in this run.\n'}
${HISTORY}`
}

if (renderOnly) {
  await fs.mkdir(outDir, { recursive: true })
  for (const fixture of FIXTURES) await fs.writeFile(`${outDir}/${fixture.file}`, await render(fixture))
  console.log(`Rendered ${FIXTURES.length} fixtures into ${outDir}`)
  process.exit(0)
}

const runner = direct ? null : viaFunction()
const results = []
const runs = {}
try {
  await fs.mkdir(outDir, { recursive: true })
  for (const [index, fixture] of FIXTURES.entries()) {
    const bytes = await render(fixture)
    await fs.writeFile(`${outDir}/${fixture.file}`, bytes)
    // The function enforces 15 s between reservations project-wide.
    if (!direct && index) await sleep(16000)
    const started = Date.now()
    const run = direct ? await extractDirect(bytes) : await runner.extract(bytes)
    runs[fixture.id] = { ...run, latencyMs: Date.now() - started }
    const result = scoreFixture(fixture, run.draft || null, run.error)
    results.push(result)
    console.log(JSON.stringify({ fixture: fixture.id, passed: result.passed, error: run.error, notes: result.notes }))
  }
} finally {
  await runner?.cleanup()
}
const summary = summarize(results)
await fs.writeFile(`${outDir}/results.json`, JSON.stringify({ model, direct, summary, results, runs }, null, 2))
await fs.writeFile('docs/menu-import-eval.md', report(results, summary, runs))
console.log(JSON.stringify(summary))
