-- Account deletion.
--
-- public.users.user_id is text and auth.users.id is uuid, so there is no FK to
-- hang `on delete cascade` from. A trigger does the cascade instead, which has
-- the advantage of firing however the auth user is removed — from the app, the
-- Supabase dashboard, or the admin API.
--
-- delete_account() is the app's entry point: it removes the caller's own auth
-- user and lets the trigger clear the workspace behind it.

create or replace function public.handle_user_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Deepest first; these tables reference each other only by id, not by FK.
  delete from public.products where user_id = old.id::text;
  delete from public.categories where user_id = old.id::text;
  delete from public.lists where user_id = old.id::text;
  delete from public.structures where user_id = old.id::text;
  delete from public.users where user_id = old.id::text;

  -- Storage is deliberately not touched here: storage.protect_delete() rejects
  -- direct deletes on storage.objects, and raising from this trigger would
  -- abort the whole account deletion. The client empties the user's folder
  -- through the Storage API before calling delete_account(); an account
  -- removed straight from the Supabase dashboard leaves its images behind.
  return old;
end;
$$;
revoke all on function public.handle_user_deleted() from public, anon, authenticated;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute procedure public.handle_user_deleted();

-- Deletes the caller's own account. security definer because `authenticated`
-- has no rights on auth.users; the auth.uid() check is what scopes it, so
-- there is deliberately no parameter to pass someone else's id.
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
