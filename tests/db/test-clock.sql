-- TEST ONLY. Never run this on a Supabase project.
--
-- The park takes orders from 5:00 PM to 10:45 PM Kuwait time, but tests must
-- pass at any hour. This replaces the one clock function so a test can pin
-- the time. Everything else (the date arithmetic, the 15-minute rule, the
-- locks) is the real migration code.
--
-- Only the database owner can replace a function, so no API user could do
-- this to a real project.

create schema test;

create table test.clock (
  only_row boolean primary key default true check (only_row),
  at timestamptz not null
);

create or replace function private.clock_now()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  select coalesce((select at from test.clock), clock_timestamp());
$$;
