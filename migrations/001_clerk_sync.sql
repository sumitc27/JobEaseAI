-- JobEaseAI Clerk + Supabase persistence schema.
-- Run this in the Supabase SQL editor after enabling Clerk as a third-party
-- authentication provider. The transaction aborts rather than guessing how to
-- reassign existing Supabase Auth rows.

begin;

create extension if not exists pgcrypto;

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  name text not null default 'Untitled Resume',
  resume_data jsonb not null default '{}'::jsonb,
  section_order jsonb not null default '[]'::jsonb,
  enabled_sections jsonb not null default '[]'::jsonb,
  section_titles jsonb not null default '{}'::jsonb,
  spacing_config jsonb not null default '{}'::jsonb,
  font text not null default 'lmodern',
  paper_size text not null default 'a4',
  is_master boolean not null default false,
  schema_version integer not null default 1,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id text primary key default (auth.jwt() ->> 'sub'),
  master_profile jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Permissive policies are combined with OR. Remove every legacy policy before
-- installing the Clerk ownership policies below.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('resumes', 'user_profiles')
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

-- Convert an empty legacy UUID owner column. Populated legacy rows require an
-- explicit, verified Supabase-user-to-Clerk-user account mapping.
do $$
declare
  owner_table text;
  owner_type text;
  has_rows boolean;
  constraint_record record;
begin
  foreach owner_table in array array['resumes', 'user_profiles']
  loop
    select c.data_type
      into owner_type
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = owner_table
       and c.column_name = 'user_id';

    if owner_type = 'uuid' then
      execute format('select exists (select 1 from public.%I limit 1)', owner_table)
        into has_rows;
      if has_rows then
        raise exception 'public.%.user_id is UUID and contains data. Link existing Supabase users to Clerk IDs before running this migration.', owner_table;
      end if;

      for constraint_record in
        select conname
          from pg_constraint
         where conrelid = format('public.%I', owner_table)::regclass
           and contype = 'f'
           and (
             select attnum
               from pg_attribute
              where attrelid = format('public.%I', owner_table)::regclass
                and attname = 'user_id'
                and not attisdropped
           ) = any (conkey)
      loop
        execute format(
          'alter table public.%I drop constraint %I',
          owner_table,
          constraint_record.conname
        );
      end loop;

      execute format(
        'alter table public.%I alter column user_id drop default, alter column user_id type text using user_id::text',
        owner_table
      );
    end if;
  end loop;
end $$;

alter table public.resumes
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id text,
  add column if not exists name text not null default 'Untitled Resume',
  add column if not exists resume_data jsonb not null default '{}'::jsonb,
  add column if not exists section_order jsonb not null default '[]'::jsonb,
  add column if not exists enabled_sections jsonb not null default '[]'::jsonb,
  add column if not exists section_titles jsonb not null default '{}'::jsonb,
  add column if not exists spacing_config jsonb not null default '{}'::jsonb,
  add column if not exists font text not null default 'lmodern',
  add column if not exists paper_size text not null default 'a4',
  add column if not exists is_master boolean not null default false,
  add column if not exists schema_version integer not null default 1,
  add column if not exists version bigint not null default 1,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_profiles
  add column if not exists user_id text,
  add column if not exists master_profile jsonb not null default '{}'::jsonb,
  add column if not exists schema_version integer not null default 1,
  add column if not exists version bigint not null default 1,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'resumes'
       and ((column_name = 'id' and data_type <> 'uuid')
         or (column_name = 'user_id' and data_type <> 'text')
         or (column_name = 'resume_data' and data_type <> 'jsonb'))
  ) then
    raise exception 'public.resumes has incompatible id, user_id, or resume_data column types.';
  end if;
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'user_profiles'
       and ((column_name = 'user_id' and data_type <> 'text')
         or (column_name = 'master_profile' and data_type <> 'jsonb'))
  ) then
    raise exception 'public.user_profiles has incompatible user_id or master_profile column types.';
  end if;
  if exists (select 1 from public.resumes where user_id is null or user_id !~ '^user_') then
    raise exception 'public.resumes contains owners that are not Clerk user IDs. Migrate those rows before continuing.';
  end if;
  if exists (select 1 from public.user_profiles where user_id is null or user_id !~ '^user_') then
    raise exception 'public.user_profiles contains owners that are not Clerk user IDs. Migrate those rows before continuing.';
  end if;
end $$;

alter table public.resumes
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column user_id set default (auth.jwt() ->> 'sub'),
  alter column user_id set not null;

alter table public.user_profiles
  alter column user_id set default (auth.jwt() ->> 'sub'),
  alter column user_id set not null;

create index if not exists resumes_user_updated_idx
  on public.resumes (user_id, updated_at desc);

create unique index if not exists resumes_id_key
  on public.resumes (id);

create unique index if not exists user_profiles_user_id_key
  on public.user_profiles (user_id);

create or replace function public.set_jobease_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists resumes_set_updated_at on public.resumes;
create trigger resumes_set_updated_at
before update on public.resumes
for each row execute function public.set_jobease_updated_at();

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_jobease_updated_at();

alter table public.resumes enable row level security;
alter table public.user_profiles enable row level security;

create policy "Users manage their own resumes"
on public.resumes
for all
to authenticated
using ((select auth.jwt() ->> 'sub') = user_id)
with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "Users manage their own profile"
on public.user_profiles
for all
to authenticated
using ((select auth.jwt() ->> 'sub') = user_id)
with check ((select auth.jwt() ->> 'sub') = user_id);

revoke all on public.resumes from PUBLIC, anon, authenticated;
revoke all on public.user_profiles from PUBLIC, anon, authenticated;
grant select, insert, update, delete on public.resumes to authenticated;
grant select, insert, update, delete on public.user_profiles to authenticated;

commit;
