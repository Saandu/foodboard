-- Narrow `authenticated` to the four privileges the app actually uses.
--
-- New tables in the `public` schema inherit Supabase's stock grants, which
-- include ALL for anon and authenticated. The private-workspaces migration
-- revoked anon's, but for authenticated it only *added* select/insert/update/
-- delete on top of what was already there. TRUNCATE, REFERENCES and TRIGGER
-- were therefore still granted.
--
-- TRUNCATE is the one that matters: it is not subject to Row Level Security,
-- so the ownership policies would not have stopped it. PostgREST never issues
-- one, so this was not reachable through the API — but the whole design rests
-- on `authenticated` holding nothing that can cross the tenancy boundary, and
-- a privilege that ignores RLS contradicts that. Revoke it rather than rely on
-- the API surface staying narrow.

revoke truncate, references, trigger
  on table public.users, public.structures, public.lists,
           public.categories, public.products, public.feedback
  from authenticated;

-- anon should hold nothing on these tables at all; assert that here so a
-- future default-grant change cannot quietly hand it access.
revoke all
  on table public.users, public.structures, public.lists,
           public.categories, public.products, public.feedback
  from anon;

-- A filed report is a record, not a document: there is deliberately no update
-- or delete policy on public.feedback. RLS already denies both without one,
-- but the grants should say the same thing.
revoke update, delete on table public.feedback from authenticated;
