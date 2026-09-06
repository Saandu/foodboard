# Roadmap

What is not built yet, roughly in the order it matters. The
[README](README.md#known-limitations) covers the tradeoffs already made; this
is the work still outstanding.

---

## Product gaps

### A visitor's uploads outlive their visit

The reset now restores the *rows* — `scripts/demo-media.json` puts the right
image back on every dish every three hours — but the object a visitor uploaded
stays in Storage, referenced by nothing. Nothing sweeps the bucket, so the demo
accumulates dead bytes at whatever rate people try the editor, and uploads are
otherwise unmetered: 5 MB an image, no per-account quota. A reset that also
deleted every object under the demo user's folder that no row references would
close both this and *Abandoned uploads* in the README.

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
into three (`src/uiLanguages.js`, `src/locales/`). 196 keys, all in sync.

---

## Open questions

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
