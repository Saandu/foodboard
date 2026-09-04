-- Somewhere for the in-app feedback form to actually send to.
--
-- The form previously validated its fields, said "thanks" and discarded the
-- report. Reports now land in a table the owner can read from the Supabase
-- dashboard.
--
-- No update or delete policy on purpose: a submitted report is a record, not
-- a document. Authors may read their own back, and `anon` cannot reach it at
-- all — you have to be signed in to file one.

create table if not exists public.feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  user_id text not null,
  subject text not null,
  message text not null,
  -- Storage object path, same bucket and ownership convention as the rest.
  attachment text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
revoke all on table public.feedback from anon;
grant select, insert on table public.feedback to authenticated;

drop policy if exists "feedback_insert_own" on public.feedback;
drop policy if exists "feedback_select_own" on public.feedback;

create policy "feedback_insert_own" on public.feedback
  for insert to authenticated
  with check ((select auth.uid())::text = user_id);

create policy "feedback_select_own" on public.feedback
  for select to authenticated
  using ((select auth.uid())::text = user_id);
