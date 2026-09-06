-- Accounts that may not delete themselves.
--
-- The sign-in page offers a shared demo account whose credentials are
-- published, so "only the owner can delete the owner's account" stopped being
-- a sufficient rule: every visitor is that owner. Hiding the button in the
-- header is presentation, not a guard — delete_account() is security definer
-- and scoped to auth.uid(), so anyone who opened a console could still call it
-- and take the showcase down for everyone.
--
-- The list lives in its own table rather than a flag on public.users because
-- users_update_own lets an account write its own row: a flag there would be
-- one PATCH away from being cleared by the very visitor it restrains.

create table if not exists public.protected_accounts (
  user_id text primary key,
  reason text not null,
  created_at timestamptz not null default now()
);

-- RLS with no policies denies every row to anon and authenticated. The only
-- reader is delete_account() below, which runs as the definer and so is not
-- subject to RLS at all. The grants say the same thing a second time, because
-- the whole point of the table is that the client cannot reach it.
alter table public.protected_accounts enable row level security;
revoke all on table public.protected_accounts from anon, authenticated;

comment on table public.protected_accounts is
  'Accounts delete_account() refuses to remove. Written by scripts/seed.js, never by the client.';

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  guard text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Checked here rather than in the client so that the console, a stale
  -- bundle and a hand-rolled request all hit the same answer.
  select reason into guard
  from public.protected_accounts
  where user_id = uid::text;

  if guard is not null then
    raise exception 'account is protected and cannot be deleted: %', guard
      using errcode = 'insufficient_privilege';
  end if;

  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
