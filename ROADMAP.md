# Roadmap

What is not built yet, roughly in the order it matters. The
[README](README.md#known-limitations) covers the tradeoffs already made; this
is the work still outstanding.

---

## Product gaps

### A shared demo account

Reviewers will not sign up to look around. A shared, read-only demo login would
open the real dashboard in one click. The interface strings already exist
(`demo_access`, `demo_access_text`, `demo_enter`, `or_log_in_manually`) and are
currently wired to nothing.

It needs `VITE_DEMO_EMAIL` and `VITE_DEMO_PASSWORD`, both inlined into the
browser bundle — which is fine and intended, since the point is that anyone may
use them, but it means the account has to be treated as hostile territory:

- make it the showcase owner (`SHOWCASE_USER_ID`), or the demo dashboard opens
  on an empty workspace
- hide "Delete account" for it
- decide what a visitor's uploads should do — see the reset question below

### Menus are invisible to search

No `sitemap.xml`, no `robots.txt`, no structured data. A restaurant's menu is
exactly what people search for by name, so [schema.org/Menu](https://schema.org/Menu)
JSON-LD and a generated sitemap would be a real feature rather than polish.

### Link previews need prerendering

Published menus set their own `title`, `description` and `og:` tags at runtime,
which fixes browser tabs, bookmarks and Google. WhatsApp, Facebook, LinkedIn
and Slack do not execute JavaScript, so a shared menu link still previews with
the generic site tags. Since sharing a menu link *is* the product, this wants a
small edge function that intercepts `/menu/:slug`, calls `get_public_menu`, and
returns HTML carrying the restaurant's own tags.

### Expiring or password-protected menus

Links can be rotated, which covers "this leaked, kill it". Still missing is
"this works until Sunday" or "ask for a code first".

### Orphaned uploads are never collected

Choosing an image uploads it immediately, so abandoning the edit leaves an
object in the bucket that nothing references. Deleting an account from the
Supabase dashboard rather than through the app leaves its whole folder behind —
`storage.protect_delete()` stops Postgres deleting storage rows, so the cascade
trigger deliberately does not try. A scheduled function that lists the bucket
and drops unreferenced objects would close both.

### Duplicate actions

Menus can be duplicated. Categories and dishes only offer edit and delete.

### More interface locales

Menus can be published in nine languages; the interface itself is translated
into three (`src/uiLanguages.js`, `src/locales/`). 206 keys, all in sync.

---

## Open questions

### What should the nightly reset protect?

The reset carries logos and dish photos across the wipe, so it does not erase
uploads made through the dashboard. That is right while a single person edits
the showcase.

A shared demo account inverts it: a visitor's uploads would survive nightly on
a public site. At that point the demo content wants to be fully declarative in
`demo-data.js` and everything else wiped. Until then the schedule is arguably
pointless, since the only work it undoes belongs to the showcase owner.

### Demo slugs are pinned

Rotating a demo restaurant's link works, but `demo-data.js` pins
`trattoria-mareluna` and `caffe-mareluna`, so the next reset re-pins them and a
rotated link stops working. Fine for a demo; worth knowing before testing
rotation and wondering why it reverted.

---

## Before this could be sold

Roughly the order a paying customer would hit them.

| | Why it blocks |
| --- | --- |
| **Privacy policy, cookie policy, terms** | The `privacy_policy` and `cookie_policy` keys exist; the pages do not. EU restaurants means GDPR — a legal blocker, not polish, and it needs real legal text rather than a template. |
| **Email deliverability** | Supabase's built-in SMTP is rate-limited and lands in spam. A password reset that silently fails is the worst possible first impression. Needs a real provider. |
| **Backups and restore** | Nothing is backed up beyond Supabase's own retention, and no restore has been tested. |
| **Billing** | Stripe, with plan limits enforced in Postgres rather than in the client. |
| **Menu import** | Nobody wants to type sixty dishes by hand. This is the objection that kills trials. |
| **Menu analytics** | Scans and views per restaurant — the most requested thing from venues, and an easy upsell. |
| **Staff accounts** | One login per restaurant does not survive contact with an actual restaurant. Needs a membership table and policies keyed on it. |
| **Uptime monitoring** | Otherwise outages arrive as customer complaints. |

---

## Quality

### No component tests

`npm test` covers the pure logic, the descriptor builders and the data-access
layer — 88 passing, plus 9 opt-in. No Vue component is mounted in a test. That
is the largest gap in coverage.

The opt-in suite is `tests/rls.test.js`, which needs `RLS_TEST_A_*` and
`RLS_TEST_B_*` set to two confirmed throwaway accounts. It is the one suite
that proves the security model rather than assuming it.

### The JSONB form-descriptor model

Records are stored as UI form descriptors rather than domain objects, with
Italian field names embedded in the data. Every read and write goes through the
constants in `src/descriptorFields.js`, so the literals live in one file and a
migration to typed columns has a single seam to cut — but that migration is the
real fix and it has not happened. Discussed in the README's limitations.

### Leaked-password protection

A Supabase Auth setting rather than code: Authentication → Policies → check
passwords against HaveIBeenPwned.

---

## Smaller things

- **Vanity slugs in the interface.** Slugs are rotatable but not editable.
  Letting an owner choose one needs a uniqueness check and a reserved-word list.
- **A dashboard view for feedback.** Reports land in `public.feedback` and are
  currently read from the Supabase dashboard.
