-- TEST ONLY. Never run this on a Supabase project.
--
-- A hosted Supabase database already has these pieces. The throwaway test
-- database is plain Postgres, so we create just enough of them for the
-- migrations to apply and for the tests to "sign in" as a user:
--   * the anon / authenticated / service_role roles the API uses
--   * auth.users, which Supabase Auth owns
--   * auth.uid(), which reads the signed-in user's id from the request token

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Same logic as Supabase's own auth.uid().
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

-- Supabase gives the API roles full rights on anything new in `public`.
-- Do the same here so the migrations' revokes are genuinely exercised.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

-- A table that has nothing to do with Qafla, with its own grants, standing in
-- for anything else that already lives in a project. The tests check that
-- the migrations leave its grants alone.
create table public.unrelated_notes (id integer primary key, body text);
grant select, insert, update, delete on public.unrelated_notes to authenticated;
grant select on public.unrelated_notes to anon;

-- The same idea for functions: something unrelated that already lives in a
-- `private` schema, callable by everyone (the Postgres default) and granted
-- to anon by name.
create schema private;
create function private.unrelated_helper()
returns text
language sql
as $$ select 'still callable' $$;
grant execute on function private.unrelated_helper() to anon;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
