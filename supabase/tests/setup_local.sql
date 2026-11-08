\set ON_ERROR_STOP on
-- Local-only Supabase compatibility layer. Run as the local postgres owner.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists auth;
create schema if not exists storage;

create or replace function auth.uid()
returns uuid language sql stable
set search_path = pg_catalog, pg_temp
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.role()
returns text language sql stable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text)
$$;
grant usage on schema auth to authenticated,anon;

create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change_token_new text,
  email_change text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_sso_user boolean not null default false
);
create table if not exists auth.identities (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  provider_id text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_id)
);
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  factor_id uuid,
  aal text,
  not_after timestamptz
);

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id) on delete cascade,
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz,
  metadata jsonb,
  version text,
  unique(bucket_id, name)
);
create or replace function storage.foldername(name text)
returns text[] language sql immutable
as $$ select string_to_array(trim(both '/' from name), '/') $$;

-- Supabase roles are cluster-wide; never create, drop, or grant auth.users to them here.
-- Supabase's managed public-schema defaults grant table DML to API roles;
-- RLS, not a missing test-table grant, must decide each tenant operation.
alter default privileges in schema public grant select,insert,update,delete
  on tables to authenticated,anon;
\ir ../migration.sql
\ir ../multi_business.sql

-- Synthetic pre-fix rows: card_codes.sql and staff_pin_fix.sql are applied
-- after these fixtures, so both real legacy backfills are exercised.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, is_sso_user)
values ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'synthetic-owner@example.test',
  extensions.crypt('owner-secret', extensions.gen_salt('bf')), now(), 'owner-confirm',
  'owner-recovery', 'owner-change-new', 'owner-change',
  jsonb_build_object('business_name','Synthetic Owner','slug','synthetic-owner'),
  jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
  now(), now(), false)
on conflict (id) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, is_sso_user)
values ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'synthetic-legacy-staff@example.test',
  extensions.crypt('0007', extensions.gen_salt('bf')), now(), null,
  null, null, null,
  jsonb_build_object('business_name','Legacy Staff'),
  jsonb_build_object('stampee_staff_provisioned',true,
    'stampee_business_id','11111111-1111-4111-8111-111111111111',
    'stampee_owner_user_id','11111111-1111-4111-8111-111111111111'),
  now(), now(), false)
on conflict (id) do nothing;
insert into auth.identities (id,user_id,identity_data,provider,provider_id,created_at,updated_at)
values ('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222',
  jsonb_build_object('sub','22222222-2222-4222-8222-222222222222'), 'email',
  '22222222-2222-4222-8222-222222222222', now(), now())
on conflict do nothing;
insert into public.business_memberships (business_id,user_id,role,access)
values ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','staff','active')
on conflict (business_id,user_id) do nothing;

insert into public.campaigns (id,owner_id,business_id,name,colors)
values ('synthetic-campaign','11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111','Synthetic Campaign','{}'::jsonb)
on conflict (id) do nothing;
insert into public.customers (id,owner_id,business_id,name,email)
values ('synthetic-customer','11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111','Synthetic Customer','synthetic-customer@example.test')
on conflict (id) do nothing;
insert into public.issued_cards (id,unique_id,customer_id,campaign_id,owner_id,business_id,
  campaign_name,stamps,last_visit,status)
values ('synthetic-card','44444444-4444-4444-8444-444444444444','synthetic-customer',
  'synthetic-campaign','11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111','Synthetic Campaign',0,current_date,'Active')
on conflict (id) do nothing;
