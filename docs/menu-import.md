# Gemini menu import: setup and operation

The implementation creates an **editable, unpublished menu** from one PDF or image. It does not publish automatically or replace existing menus. Extraction uses Google Gemini through an authenticated Supabase Edge Function; saving happens in one PostgreSQL transaction.

## Where to put the API key

Create a Gemini API key for your FoodBoard project in [Google AI Studio](https://aistudio.google.com/api-keys). Restrict it to the Generative Language API. The Gemini API project and your Supabase project are separate services.

In **Supabase Dashboard → your FoodBoard project → Edge Functions → Secrets**, add:

| Secret | Value |
| --- | --- |
| `GEMINI_API_KEY` | Your Google AI Studio key |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` initially; use an exact model ID supported by your Google project |
| `MENU_IMPORT_ENABLED` | `true` |
| `MENU_IMPORT_ORIGINS` | Comma-separated website origins, e.g. `http://localhost:5173,https://foodboard-demo.web.app` |

Add every origin you actually use, including Firebase's alternate domain or your custom domain. An origin contains only the scheme, hostname and optional port, with no trailing slash or path. CORS is an additional browser restriction; authentication and ownership checks protect the endpoint independently.

**Do not put the key in a `VITE_` variable, client code, Git, or chat.** Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions automatically. Those service credentials also stay on the backend.

For CLI setup, copy `supabase/functions/.env.example` to `supabase/functions/.env.local`, replace the key, model and origins, and upload that ignored file with `npx supabase secrets set --env-file supabase/functions/.env.local`. The example file contains placeholders only.

## Deploy in order

From the repository root:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase secrets set --env-file supabase/functions/.env.local
npx supabase functions deploy menu-import --use-api
npm run dev
```

Review the dry run before applying it. If your remote database predates the migration history, reconcile that history rather than blindly applying every historical migration. The new migration is `supabase/migrations/20261004191254_menu_import.sql`. It adds private usage controls and service-only save/reservation functions, and replaces an incompatible category foreign key with an ownership check matching FoodBoard's nested category format. It preserves existing menus and records; the new product check applies to future inserts and category/owner changes.

`supabase/config.toml` disables the gateway's legacy JWT check for this function. The handler still validates the bearer token using `Auth.getUser`, rejects anonymous/unconfirmed accounts, verifies restaurant ownership. Do not remove those handler checks.

The frontend can be deployed through the project's existing Firebase workflow after the backend is configured. Local implementation and mocked browser tests do not establish that Gemini or the deployed function work with your key.

## Owner workflow

1. Sign in with your **own confirmed account** and choose a restaurant.
2. Open its menu list and choose **Import from PDF or photo**.
3. Choose one PDF, JPG, PNG or WebP and consent to sending it to Google.
4. The backend checks the token, ownership, file signature, size and PDF page count. It reserves quota before calling Gemini once.
5. Gemini receives the original file with an extraction prompt and JSON schema. The backend validates the result independently, rejecting incomplete output and menus beyond the supported bounds.
6. Compare the draft with the original. Edit names, descriptions, categories, price variants and explicitly declared allergens; remove unwanted dishes or categories. Unknown prices must be filled in before saving.
7. Confirm that you reviewed it and choose **Save as draft**. Currency mismatch blocks saving; changing the detected currency does not convert prices. Ensure the restaurant's currency is correct.
8. A transaction creates the list, category group and product groups together, then returns you to the menu list. The menu remains unpublished until you publish it through the existing editor.

The original language is preserved. No automatic translation is performed. Other language views fall back to the source text; translate later in the normal editor. Unsupported source languages need manual review under a supported language tab.

The shared demo can upload PDFs/images, call Gemini and save unpublished imports using the same ownership and quota checks as other accounts. All demo visitors share the three-attempt daily account quota. Scheduled showcase resets remove demo changes; personal accounts retain their menus. **Try a sample** exercises the review UI without an API request and can also be saved as a draft. Account deletion protection remains enabled.

## Limits, failure handling and costs

- One file per extraction; **8 MB**, **five PDF pages**, **20 categories**, **150 dishes**, at most **six price variants per dish**.
- **Three extraction attempts per account per UTC day**, **20 across the project per UTC day**, at least **60 seconds per account** and **15 seconds across the project** between reservations. Attempts count even if Google fails; there are no automatic paid retries. These are application limits, not Google quota guarantees. Change them in a migration when actual usage warrants it.
- At most 20,000 output tokens and a 90-second provider timeout. Gemini 3 models use low thinking depth for this extraction task. A larger/unclear menu may require a smaller source file. Extraction is synchronous; navigating away can lose the returned draft, and a request already sent to Google may still be charged.
- Save retries reuse the same import ID and payload. After an unconfirmed save the editor freezes, and the retry confirms the same transaction rather than creating duplicates. If you leave during a pending save, check the dashboard before starting another import.
- Set `MENU_IMPORT_ENABLED=false` in Supabase secrets to stop extraction and import saving.
- `menu_import_attempts` retains only account ID, attempt time, model and aggregate Gemini token usage, and prunes attempts older than two days at the next reservation. Receipts retain IDs and a payload hash to support safe save retries. Account deletion cascades both tables.
- FoodBoard keeps original files only in browser/backend memory. Files are not uploaded to Storage or retained in logs. Google receives them under the applicable [Gemini API terms](https://ai.google.dev/gemini-api/terms). Those terms require Paid Services when making API clients available to users in the EEA, Switzerland or UK; Gemini API Paid Services require a Cloud project with an active billing account. Private development experiments and a public FoodBoard rollout are different cases. Google's regional data terms also differ, so do not assume every free-quota project has the same data treatment.
- Google AI Plus does not enable this backend. Use your project's Gemini API quota/billing. API availability and prices depend on model and project; inspect [AI Studio usage](https://aistudio.google.com/usage) and [current pricing](https://ai.google.dev/gemini-api/docs/pricing). Billing budget alerts notify you; they are not hard spending caps. App limits help bound usage but do not cover other apps using the same Google key/project.

## Why the PDF stays a PDF

Gemini understands PDF pages visually already. Google documents PDF pages as image-modality input, with token accounting affected by the model and media resolution. Converting to images is not a guaranteed saving and can lose extractable text or small print. See [document processing](https://ai.google.dev/gemini-api/docs/document-processing) and [media resolution](https://ai.google.dev/gemini-api/docs/media-resolution).

This version sends PDFs directly. Compare recorded prompt/output token usage and extraction accuracy on the same real menus before adding rendering/downscaling. A restaurant menu's small prices and allergen legend are more valuable than a marginal token saving.

## Verify with your key before release

1. Run `npm run lint`, `npm test`, `npm run build`, and `npx playwright test e2e/menu-import.spec.js`. Database tests run the actual migration in isolated PostgreSQL via PGlite. Browser tests mock provider/backend responses and cover desktop/mobile review, consent, accessibility and saving.
2. Typecheck the function with `npx deno check --config supabase/functions/menu-import/deno.json supabase/functions/menu-import/index.ts` and run `npx deno test --allow-env --config supabase/functions/menu-import/deno.json supabase/functions/menu-import/index_test.ts`. These backend tests mock Google and Supabase network responses and verify auth, file checks, quotas and safe saving without secrets or paid requests.
3. On a private test account, import one clear image and one short PDF; compare every extracted price and allergen. Save and verify both menus are unpublished. Inspect them in the existing category editor; confirm portion variants survive.
4. Test a damaged/password-protected PDF, a six-page PDF, a non-menu image, provider quota errors and an attempted second-account import. Verify the backend rejects unauthenticated calls and allows owned shared-demo imports.
5. Check token usage in Google AI Studio and the private usage table. Set suitable application quotas before broader use. Document measured extraction accuracy and latency before making CV performance claims.

Release verification on **2026-10-04**: the import migration and Edge Function were deployed to the FoodBoard Supabase project, and the frontend was deployed to Firebase Hosting. Real synthetic PDF extraction and live browser image upload → review → unpublished save passed with `gemini-3.5-flash-lite`. Both tests preserved three dishes, two categories and multiple portion prices. Live authentication, ownership, quota and duplicate-save checks passed, and disposable accounts were removed. Main-branch CI and the database-security workflow passed. This validates the integration on the test fixtures; restaurant menus still require owner review.

The test PDF used **799 input + 367 output tokens**, and the PNG used **1,351 input + 367 output tokens**. Direct PDF input used fewer tokens for this particular fixture; this is not a universal cost guarantee. The PDF extraction took about five seconds. Google returned model-not-found for the earlier 2.5 Flash setting and temporary-unavailability errors for 3.8 Flash, so this release uses the successfully verified 3.5 Flash-Lite model.

For an explicit release smoke test, run `node scripts/smoke-menu-import.mjs --api-only`, then `node scripts/smoke-menu-import.mjs --browser-only` after deploying the frontend. The script uses the existing server credentials in `.env`, creates disposable confirmed accounts without sending email, uploads synthetic PDF/image menus, verifies safe saving, and removes its accounts and data in a `finally` block. Each mode makes one real Gemini request. `MENU_IMPORT_TEST_ORIGIN` can select a different deployed website. Screenshots and synthetic fixtures go into ignored `test-results/`.
