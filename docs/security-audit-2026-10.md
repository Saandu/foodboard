# Security audit, October 2026

On 2026-10-05 I audited FoodBoard with an AI coding assistant (Claude Code),
following a published audit method. The assistant proposed candidate findings;
each one was confirmed by reading the source before it was accepted, and each
fix was mine to decide. Scope: Postgres policies and functions, storage
policies, the menu-import Edge Function, client-side rendering, the auth flows,
CI and secrets.

Eight findings were confirmed and fixed in
[`20261006000000_security_audit_fixes.sql`](../supabase/migrations/20261006000000_security_audit_fixes.sql)
and the prerender script. Every fix has a regression case in
[`tests/securityFixes.test.js`](../tests/securityFixes.test.js), which runs
every migration in order on an in-memory Postgres (PGlite) and fails without
the fix.

Most of them come from one habit: a guard was written for the row in hand,
and not for the rows it points at, the column nobody expected to be written,
or the account everyone shares.

| # | Finding | Impact | Fix |
| --- | --- | --- | --- |
| 1 | Child rows could hang off another account's parent. Owner policies checked only the new row's `user_id`, so a second account could add a menu under someone else's restaurant, a category under someone else's menu, or reuse someone else's category id for its own dishes. | Content injected into another restaurant's public menu, and the planted rows blocked that owner's deletions and the demo reset. | Policies check the parent's owner. Category ids are first-writer-wins across accounts. `get_public_menu` publishes only the structure owner's rows. Planted rows are removed by the migration. |
| 2 | Anonymous storage listing. `structure_media_read` let anyone list every tenant's folders. | Account ids, unpublished restaurants and private feedback screenshots were enumerable; in a public bucket a listed name is a readable URL. | Listing is limited to the owner's own folder. Public menu images still load by URL. |
| 3 | A revoked public link could be claimed. `public_slug` was writable by its owner. | After an owner rotated their link, anyone could take the old one, so printed QR codes would open the attacker's menu. | Slugs are issued, never chosen: column-level grants exclude `public_slug`, and `rotate_public_slug` checks ownership itself. |
| 4 | Path traversal and HTML injection at build time. A chosen slug such as `../index` reached the prerender script as a file path and as markup. | A user could overwrite the deployed home page during a build. | A format `CHECK` constraint on the slug; the prerender skips malformed slugs and escapes the slug in the canonical link and sitemap. |
| 5 | Deleting an account refunded the AI budget. Import attempt rows cascaded from `auth.users`, and the daily caps count surviving rows. | Sign-up, extract, delete loops reset the project-wide daily Gemini spending cap. | Attempt rows no longer cascade from the auth user; they hold only an id and are pruned after two days anyway. |
| 6 | The shared demo could delete or replace its stored images. The reset restores image paths, not image bytes. | One visitor could permanently break the showcase images for everyone. | Protected accounts cannot update or delete stored objects. Uploading new images still works. |
| 7 | The shared demo's credentials could be changed. Its password is published. | Any visitor could set a new password and lock everyone else out; the reset only rebuilds public tables. | A trigger on `auth.users` refuses credential changes for protected accounts, with a deliberate session-level override for maintenance. |
| 8 | The showcase reset could be blocked by squatted ids. | Rows another account planted under the showcase's fixed ids made the scheduled reset fail. | `reset_showcase` clears foreign rows holding showcase ids or hanging off showcase parents before rebuilding. |

## Shipping the fixes

- Production was checked for rows matching finding 1 before migrating, so the
  clean-up removed only planted rows.
- The migration history on the live project matches the repository.
- After deploying, the public menus, sign-in, the demo account and the
  protected flows were checked on the live site.

The same release fixed two non-security bugs found during the work: one demo
visitor signing out ended every other visitor's session (sign-out is now
local to the browser), and a regression had dropped translated menu names on
the public menu.

## Limits of this audit

This was a review of the code and configuration in this repository, not a
penetration test of the hosted infrastructure, and it does not cover the
providers themselves (Supabase, Google, Firebase). A clean audit is a point in
time; the regression suite is what keeps these eight closed.
