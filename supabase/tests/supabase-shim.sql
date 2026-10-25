-- LOCAL TESTS ONLY. The bits of a Supabase database the migration relies on, for running it on a
-- plain Postgres: the auth schema with its users table and auth.uid(), and the anon /
-- authenticated roles with Supabase's default grants. Never run this on a real Supabase project.
create role anon nologin;
create role authenticated nologin;
create role authenticator login password 'authpass' noinherit;
grant anon, authenticated to authenticator;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}',
  created_at timestamptz default now(),
  last_sign_in_at timestamptz
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
