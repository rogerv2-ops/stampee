-- ============================================================
-- Stampee: multi-business workspaces (upgrade after migration.sql)
-- Idempotent, additive migration.  It deliberately keeps profiles.owner_id,
-- profiles.slug and all existing public URL inputs for transition compatibility.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Business catalogue and memberships
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null default '',
  slug text not null,
  status text not null default 'unverified' check (status in ('unverified','verified')),
  access text not null default 'active' check (access in ('active','disabled')),
  tier text not null default 'free' check (tier in ('free','pro')),
  tier_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists businesses_owner_user_id_idx
  on public.businesses (owner_user_id);

create table if not exists public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','staff')),
  access text not null default 'active' check (access in ('active','disabled')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists business_memberships_user_idx
  on public.business_memberships (user_id, access);

alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;

-- SECURITY DEFINER helpers avoid recursive policies and never trust JWT metadata.
create or replace function public.is_business_member(p_business_id uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.business_memberships bm
    join public.businesses b on b.id = bm.business_id
    where bm.business_id = p_business_id and bm.user_id = auth.uid()
      and bm.access = 'active' and b.access = 'active'
  )
$$;

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.business_memberships bm
    join public.businesses b on b.id = bm.business_id
    where bm.business_id = p_business_id and bm.user_id = auth.uid()
      and bm.role = 'owner' and bm.access = 'active' and b.access = 'active'
  )
$$;

create or replace function public.is_business_staff(p_business_id uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.business_memberships bm
    join public.businesses b on b.id = bm.business_id
    where bm.business_id = p_business_id and bm.user_id = auth.uid()
      and bm.role = 'staff' and bm.access = 'active' and b.access = 'active'
  )
$$;

-- Backfill one business per existing owner, with id equal to profiles.id.
insert into public.businesses (id, owner_user_id, business_name, slug, status, access, tier, tier_expires_at, created_at)
select p.id, p.id, p.business_name,
       coalesce(nullif(trim(p.slug), ''), 'business-' || replace(p.id::text, '-', '')),
       p.status, p.access, p.tier, p.tier_expires_at, p.created_at
from public.profiles p
where p.role = 'owner'
  and not exists (select 1 from public.businesses b where b.id = p.id)
on conflict (id) do nothing;

-- A pre-existing slug collision is retained on profiles, but businesses must be unique.
-- The suffix is deterministic and only applies to the newly-created business row.
do $$
declare r record; v_slug text;
begin
  for r in
    select b.id, b.slug from public.businesses b
    where exists (select 1 from public.businesses b2 where b2.slug=b.slug and b2.id < b.id)
  loop
    v_slug := trim(r.slug) || '-' || substr(replace(r.id::text, '-', ''), 1, 8);
    while exists (select 1 from public.businesses b2 where b2.slug=v_slug and b2.id<>r.id) loop
      v_slug := v_slug || '-' || substr(replace(r.id::text, '-', ''), 9, 4);
    end loop;
    update public.businesses set slug = v_slug where id = r.id;
  end loop;
end $$;

-- Preserve historical case-sensitive slugs/URLs. New and changed slugs are
-- protected case-insensitively by the trigger below; legacy case-only duplicates
-- remain readable and cannot be claimed by new businesses.
drop index if exists public.businesses_slug_lower_uq;
create unique index if not exists businesses_slug_uq on public.businesses (slug);
create or replace function public.enforce_business_slug_uniqueness()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_slug text:=lower(trim(new.slug));
begin
  if v_slug is null or v_slug='' then raise exception 'INVALID_BUSINESS_SLUG'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_slug,0));
  if exists(select 1 from public.businesses b where b.id<>new.id and lower(trim(b.slug))=v_slug) then
    raise exception 'SLUG_ALREADY_IN_USE';
  end if;
  return new;
end $$;
drop trigger if exists businesses_slug_unique on public.businesses;
create trigger businesses_slug_unique before insert or update of slug on public.businesses
for each row execute function public.enforce_business_slug_uniqueness();

insert into public.business_memberships (business_id, user_id, role, access)
select b.id, b.owner_user_id, 'owner', b.access
from public.businesses b
on conflict (business_id, user_id) do update set role='owner', access=excluded.access;

-- ---------------------------------------------------------------------------
-- 2. Add business_id to legacy rows and backfill it without changing owner_id.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists business_id uuid;
alter table public.campaigns add column if not exists business_id uuid;
alter table public.customers add column if not exists business_id uuid;
alter table public.issued_cards add column if not exists business_id uuid;
alter table public.transactions add column if not exists business_id uuid;

update public.profiles p set business_id = case when p.role='owner' then p.id else p.owner_id end
where p.business_id is null;
insert into public.business_memberships (business_id, user_id, role, access)
select p.business_id, p.id, 'staff', p.access
from public.profiles p
where p.role='staff' and p.business_id is not null
on conflict (business_id, user_id) do update set role='staff', access=excluded.access;
update public.campaigns c set business_id = c.owner_id where c.business_id is null;
update public.customers c set business_id = c.owner_id where c.business_id is null;
update public.issued_cards ic set business_id = ic.owner_id where ic.business_id is null;
update public.transactions t set business_id = ic.business_id
from public.issued_cards ic where ic.id=t.card_id and t.business_id is null;

-- Existing malformed rows are refused rather than silently assigned to another business.
do $$
begin
  if exists (select 1 from public.profiles where business_id is null)
     or exists (select 1 from public.campaigns where business_id is null)
     or exists (select 1 from public.customers where business_id is null)
     or exists (select 1 from public.issued_cards where business_id is null)
     or exists (select 1 from public.transactions where business_id is null) then
    raise exception 'MULTI_BUSINESS_BACKFILL_INCOMPLETE: repair orphaned legacy rows before retrying';
  end if;
end $$;

alter table public.profiles alter column business_id set not null;
alter table public.campaigns alter column business_id set not null;
alter table public.customers alter column business_id set not null;
alter table public.issued_cards alter column business_id set not null;
alter table public.transactions alter column business_id set not null;

create index if not exists profiles_business_idx on public.profiles (business_id);
create index if not exists campaigns_business_idx on public.campaigns (business_id);
create index if not exists customers_business_idx on public.customers (business_id);
create index if not exists issued_cards_business_idx on public.issued_cards (business_id);
create index if not exists transactions_business_idx on public.transactions (business_id);

create or replace function public.current_staff_owner_id()
returns uuid language sql security definer stable set search_path=public,pg_temp as $$
  select b.owner_user_id
  from public.profiles p
  join public.business_memberships bm on bm.business_id=p.business_id and bm.user_id=p.id
  join public.businesses b on b.id=bm.business_id
  where p.id=auth.uid() and p.role='staff' and bm.role='staff'
    and bm.access='active' and b.access='active'
  limit 1
$$;

-- Composite keys make cross-business references impossible even for SECURITY DEFINER code.
create unique index if not exists campaigns_id_business_uq on public.campaigns(id,business_id);
create unique index if not exists customers_id_business_uq on public.customers(id,business_id);
create unique index if not exists issued_cards_id_business_uq on public.issued_cards(id,business_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='campaigns_business_fkey') then
    alter table public.campaigns add constraint campaigns_business_fkey
      foreign key (business_id) references public.businesses(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='customers_business_fkey') then
    alter table public.customers add constraint customers_business_fkey
      foreign key (business_id) references public.businesses(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='issued_cards_business_fkey') then
    alter table public.issued_cards add constraint issued_cards_business_fkey
      foreign key (business_id) references public.businesses(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='transactions_business_fkey') then
    alter table public.transactions add constraint transactions_business_fkey
      foreign key (business_id) references public.businesses(id) on delete cascade;
  end if;
  alter table public.issued_cards drop constraint if exists campaign_customer_same_business_fkey;
  alter table public.issued_cards add constraint campaign_customer_same_business_fkey
    foreign key (customer_id,business_id) references public.customers(id,business_id) on delete cascade;
  alter table public.issued_cards drop constraint if exists card_campaign_same_business_fkey;
  alter table public.issued_cards add constraint card_campaign_same_business_fkey
    foreign key (campaign_id,business_id) references public.campaigns(id,business_id) on delete set null (campaign_id);
  alter table public.transactions drop constraint if exists transaction_card_same_business_fkey;
  alter table public.transactions add constraint transaction_card_same_business_fkey
    foreign key (card_id,business_id) references public.issued_cards(id,business_id) on delete cascade;
end $$;

create or replace function public.enforce_workspace_row_identity()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business_id uuid; v_owner_id uuid; v_expected_owner uuid;
begin
  v_business_id := (to_jsonb(new)->>'business_id')::uuid;
  if v_business_id is null then raise exception 'BUSINESS_ID_REQUIRED'; end if;
  if tg_op='UPDATE' and (to_jsonb(new)->>'business_id') is distinct from (to_jsonb(old)->>'business_id') then
    raise exception 'BUSINESS_ID_IS_IMMUTABLE';
  end if;
  select owner_user_id into v_expected_owner from public.businesses where id=v_business_id;
  if v_expected_owner is null then raise exception 'BUSINESS_NOT_FOUND'; end if;
  if to_jsonb(new) ? 'owner_id' then
    v_owner_id := (to_jsonb(new)->>'owner_id')::uuid;
    if v_owner_id is distinct from v_expected_owner then raise exception 'OWNER_ID_DOES_NOT_MATCH_BUSINESS'; end if;
    if tg_op='UPDATE' and (to_jsonb(new)->>'owner_id') is distinct from (to_jsonb(old)->>'owner_id') then
      raise exception 'OWNER_ID_IS_IMMUTABLE';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists campaigns_workspace_identity on public.campaigns;
create trigger campaigns_workspace_identity before insert or update on public.campaigns
for each row execute function public.enforce_workspace_row_identity();
drop trigger if exists customers_workspace_identity on public.customers;
create trigger customers_workspace_identity before insert or update on public.customers
for each row execute function public.enforce_workspace_row_identity();
drop trigger if exists issued_cards_workspace_identity on public.issued_cards;
create trigger issued_cards_workspace_identity before insert or update on public.issued_cards
for each row execute function public.enforce_workspace_row_identity();
drop trigger if exists transactions_workspace_identity on public.transactions;
create trigger transactions_workspace_identity before insert or update on public.transactions
for each row execute function public.enforce_workspace_row_identity();

-- Keep profile/business values aligned for legacy reads; owner_id remains untouched.
create or replace function public.enforce_profile_business_consistency()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.role='owner' then new.business_id := new.id;
  elsif new.owner_id is not null then
    if new.business_id is null or not exists (
      select 1 from public.businesses b
      where b.id=new.business_id and b.owner_user_id=new.owner_id
    ) then
      new.business_id := (select p.business_id from public.profiles p where p.id=new.owner_id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_business_consistency on public.profiles;
create trigger profiles_business_consistency before insert or update of role,owner_id,business_id on public.profiles
for each row execute function public.enforce_profile_business_consistency();

create or replace function public.guard_profile_sensitive_fields()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() = old.id and (
    new.role is distinct from old.role or new.owner_id is distinct from old.owner_id
    or new.business_id is distinct from old.business_id or new.slug is distinct from old.slug
    or new.status is distinct from old.status or new.access is distinct from old.access
  ) then
    raise exception 'PROFILE_PRIVILEGED_FIELDS_ARE_IMMUTABLE';
  end if;
  if auth.uid() = old.id
     and (new.tier is distinct from old.tier or new.tier_expires_at is distinct from old.tier_expires_at)
     and current_setting('stampee.allow_license_activation', true) is distinct from 'true' then
    raise exception 'PROFILE_PRIVILEGED_FIELDS_ARE_IMMUTABLE';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_sensitive_fields on public.profiles;
create trigger profiles_guard_sensitive_fields before update on public.profiles
for each row execute function public.guard_profile_sensitive_fields();

drop policy if exists "Owners can update own staff profiles" on public.profiles;
drop policy if exists "Owners can insert staff profiles" on public.profiles;

create or replace function public.provision_owner_business_after_profile_insert()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.role='owner' then
    insert into public.businesses(id,owner_user_id,business_name,slug,status,access,tier,tier_expires_at,created_at)
    values(new.id,new.id,new.business_name,
      coalesce(nullif(trim(new.slug),''),'business-'||replace(new.id::text,'-','')),
      new.status,new.access,new.tier,new.tier_expires_at,new.created_at)
    on conflict (id) do nothing;
    insert into public.business_memberships(business_id,user_id,role,access)
    values(new.id,new.id,'owner',new.access)
    on conflict (business_id,user_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists profiles_provision_owner_business on public.profiles;
create trigger profiles_provision_owner_business after insert on public.profiles
for each row execute function public.provision_owner_business_after_profile_insert();

-- ---------------------------------------------------------------------------
-- 3. RLS: membership is the only source of workspace access.
-- ---------------------------------------------------------------------------
-- Refuse unknown policies rather than deleting project-specific security rules.
-- Review and reconcile any reported policy before retrying the migration.
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname='public'
      and tablename = any(array['profiles','businesses','business_memberships','campaigns','customers','issued_cards','transactions'])
      and policyname not in (
        'Users can read own profile','Owners can read own staff profiles','Staff can read owner profile',
        'Users can update own profile','Owners can update own staff profiles','Owners can insert staff profiles',
        'Allow trigger insert for new signups','business members can read businesses','business owners can update businesses',
        'members can read memberships','Owners can manage own campaigns','Staff can read owner campaigns',
        'workspace members read campaigns','workspace owners manage campaigns','Owners can manage own customers',
        'Staff can read owner customers','Staff can update owner customers','workspace members read customers',
        'workspace owners manage customers','workspace staff insert customers','workspace staff update customers',
        'Owners can manage own issued cards','Staff can read owner issued cards','Staff can update owner issued cards',
        'workspace members read cards','workspace owners manage cards','workspace staff insert cards',
        'workspace staff update cards','Owners can manage transactions for own cards','Staff can read owner transactions',
        'Staff can insert transactions for owner cards','workspace members read transactions',
        'workspace owners manage transactions','workspace staff insert transactions'
      )
  loop
    raise exception 'MULTI_BUSINESS_UNEXPECTED_POLICY: %.%', p.tablename, p.policyname;
  end loop;
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='license_keys'
      and policyname not in ('Users can read own license keys','Users can claim a license key')
  ) then
    raise exception 'MULTI_BUSINESS_UNEXPECTED_POLICY: custom license_keys policy; review before retrying';
  end if;
end $$;

-- Replace only the canonical policies from migration.sql and this migration.
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname='public'
      and tablename = any(array['profiles','businesses','business_memberships','campaigns','customers','issued_cards','transactions'])
      and policyname in (
        'Owners can read own staff profiles','Owners can update own staff profiles','Owners can insert staff profiles',
        'business members can read businesses','business owners can update businesses',
        'members can read memberships','Owners can manage own campaigns','Staff can read owner campaigns',
        'workspace members read campaigns','workspace owners manage campaigns','Owners can manage own customers',
        'Staff can read owner customers','Staff can update owner customers','workspace members read customers',
        'workspace owners manage customers','workspace staff insert customers','workspace staff update customers',
        'Owners can manage own issued cards','Staff can read owner issued cards','Staff can update owner issued cards',
        'workspace members read cards','workspace owners manage cards','workspace staff insert cards',
        'workspace staff update cards','Owners can manage transactions for own cards','Staff can read owner transactions',
        'Staff can insert transactions for owner cards','workspace members read transactions',
        'workspace owners manage transactions','workspace staff insert transactions'
      )
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "Owners can read own staff profiles" on public.profiles for select
using (role='staff' and public.is_business_owner(business_id));
create policy "business members can read businesses" on public.businesses for select
using (public.is_business_member(id));
create policy "members can read memberships" on public.business_memberships for select
using (user_id=auth.uid() or public.is_business_owner(business_id));
-- No client insert/update/delete policy: membership changes are server-side RPCs only.
drop policy if exists "Users can claim a license key" on public.license_keys;

alter table public.campaigns enable row level security;
alter table public.customers enable row level security;
alter table public.issued_cards enable row level security;
alter table public.transactions enable row level security;

create policy "workspace members read campaigns" on public.campaigns for select
using (public.is_business_member(business_id));
create policy "workspace owners manage campaigns" on public.campaigns for all
using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

create policy "workspace members read customers" on public.customers for select
using (public.is_business_member(business_id));
create policy "workspace owners manage customers" on public.customers for all
using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));
create policy "workspace staff insert customers" on public.customers for insert
with check (public.is_business_staff(business_id));
create policy "workspace staff update customers" on public.customers for update
using (public.is_business_staff(business_id)) with check (public.is_business_staff(business_id));

create policy "workspace members read cards" on public.issued_cards for select
using (public.is_business_member(business_id));
create policy "workspace owners manage cards" on public.issued_cards for all
using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));
create policy "workspace staff insert cards" on public.issued_cards for insert
with check (public.is_business_staff(business_id));
create policy "workspace staff update cards" on public.issued_cards for update
using (public.is_business_staff(business_id)) with check (public.is_business_staff(business_id));

create policy "workspace members read transactions" on public.transactions for select
using (public.is_business_member(business_id));
create policy "workspace owners manage transactions" on public.transactions for all
using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));
create policy "workspace staff insert transactions" on public.transactions for insert
with check (public.is_business_staff(business_id));

-- ---------------------------------------------------------------------------
-- 4. Business RPCs and first-business signup.
-- ---------------------------------------------------------------------------
create or replace function public.is_business_slug_available(slug_input text)
returns boolean language sql security definer stable set search_path=public,pg_temp as $$
  select nullif(lower(trim(slug_input)), '') is not null
     and not exists (select 1 from public.businesses where lower(trim(slug))=lower(trim(slug_input)))
$$;
create or replace function public.is_slug_available(slug_input text)
returns boolean language sql security definer stable set search_path=public,pg_temp as $$
  select public.is_business_slug_available(slug_input)
$$;

create or replace function public.create_business(business_name_input text, slug_input text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid := gen_random_uuid(); v_slug text := lower(trim(slug_input)); v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.profiles where id=v_uid and role='owner') then raise exception 'ONLY_OWNER_IDENTITY'; end if;
  if nullif(trim(business_name_input),'') is null or v_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$' then raise exception 'INVALID_BUSINESS'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_slug,0));
  if not public.is_business_slug_available(v_slug) then raise exception 'SLUG_ALREADY_IN_USE'; end if;
  insert into public.businesses(id,owner_user_id,business_name,slug,status,access,tier)
  select v_id,v_uid,trim(business_name_input),v_slug,p.status,p.access,p.tier from public.profiles p where p.id=v_uid;
  insert into public.business_memberships(business_id,user_id,role) values(v_id,v_uid,'owner');
  return v_id;
end $$;

create or replace function public.update_business_profile(business_id_input uuid,business_name_input text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_business_owner(business_id_input) then raise exception 'ONLY_BUSINESS_OWNER'; end if;
  if nullif(trim(business_name_input),'') is null then raise exception 'INVALID_BUSINESS_NAME'; end if;
  update public.businesses set business_name=trim(business_name_input) where id=business_id_input;
  if business_id_input=auth.uid() then
    update public.profiles set business_name=trim(business_name_input) where id=auth.uid();
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business_id uuid; v_owner_id uuid; v_slug text;
begin
  if new.raw_app_meta_data->>'stampee_staff_provisioned'='true' then
    begin
      v_business_id := (new.raw_app_meta_data->>'stampee_business_id')::uuid;
      v_owner_id := (new.raw_app_meta_data->>'stampee_owner_user_id')::uuid;
    exception when others then
      raise exception 'INVALID_STAFF_PROVISIONING_METADATA';
    end;
    if v_owner_id is null or not exists (
      select 1 from public.businesses b
      join public.business_memberships m on m.business_id=b.id
      where b.id=v_business_id and b.owner_user_id=v_owner_id
        and b.access='active' and m.user_id=v_owner_id and m.role='owner' and m.access='active'
    ) then
      raise exception 'ONLY_BUSINESS_OWNER';
    end if;
    insert into public.profiles(id,business_name,email,slug,role,owner_id,business_id,status,access,tier)
    values(new.id,coalesce(new.raw_user_meta_data->>'business_name',''),new.email,null,
           'staff',v_owner_id,v_business_id,'verified','active','free')
    on conflict(id) do nothing;
    return new;
  end if;

  -- Public user metadata cannot choose role, owner, or business membership.
  v_slug := coalesce(nullif(lower(trim(new.raw_user_meta_data->>'slug')),''),'business-'||replace(new.id::text,'-',''));
  if v_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$' then raise exception 'INVALID_BUSINESS_SLUG'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_slug,0));
  if not public.is_business_slug_available(v_slug) then raise exception 'SLUG_ALREADY_IN_USE'; end if;
  insert into public.profiles(id,business_name,email,slug,role,owner_id,status,access,tier)
  values(new.id,coalesce(new.raw_user_meta_data->>'business_name',''),new.email,
         v_slug,'owner',null,
         'unverified','active','free') on conflict(id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Staff RPCs: new business-scoped signatures plus legacy wrappers.
-- ---------------------------------------------------------------------------
create or replace function public.create_staff_account(staff_email text, staff_pin text, staff_name text, business_id_input uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_uid uuid:=gen_random_uuid(); v_owner uuid:=auth.uid(); v_email text:=lower(trim(staff_email));
begin
  if not public.is_business_owner(business_id_input) then raise exception 'ONLY_BUSINESS_OWNER'; end if;
  if length(staff_pin) not between 4 and 6 or staff_pin !~ '^[0-9]+$' then raise exception 'PIN_MUST_BE_4_6_DIGITS'; end if;
  if v_email is null or v_email='' then raise exception 'EMAIL_REQUIRED'; end if;
  if exists(select 1 from auth.users where lower(email)=v_email) then raise exception 'EMAIL_ALREADY_IN_USE'; end if;
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,created_at,updated_at,is_sso_user)
  values(new_uid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',v_email,extensions.crypt(staff_pin,extensions.gen_salt('bf')),now(),jsonb_build_object('business_name',staff_name),jsonb_build_object('provider','email','providers',array_to_json(array['email']),'stampee_staff_provisioned',true,'stampee_business_id',business_id_input,'stampee_owner_user_id',v_owner),now(),now(),false);
  insert into auth.identities(id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  values(new_uid,new_uid,jsonb_build_object('sub',new_uid::text,'email',v_email),'email',new_uid::text,now(),now(),now());
  insert into public.business_memberships(business_id,user_id,role) values(business_id_input,new_uid,'staff');
  return new_uid;
end $$;
create or replace function public.create_staff_account(staff_email text, staff_pin text, staff_name text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin return public.create_staff_account(staff_email,staff_pin,staff_name,(select business_id from public.profiles where id=auth.uid())); end $$;

create or replace function public.update_staff_pin(staff_id uuid,new_pin text,business_id_input uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_business_owner(business_id_input) or not exists(select 1 from public.business_memberships where business_id=business_id_input and user_id=staff_id and role='staff') then raise exception 'NOT_YOUR_STAFF_MEMBER'; end if;
  if new_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN_MUST_BE_4_6_DIGITS'; end if;
  update auth.users set encrypted_password=extensions.crypt(new_pin,extensions.gen_salt('bf')),updated_at=now() where id=staff_id;
end $$;
create or replace function public.update_staff_pin(staff_id uuid,new_pin text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.update_staff_pin(staff_id,new_pin,(select business_id from public.profiles where id=auth.uid())); end $$;

create or replace function public.set_staff_access(staff_id uuid,access_input text,business_id_input uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_business_owner(business_id_input) then raise exception 'ONLY_BUSINESS_OWNER'; end if;
  if access_input not in ('active','disabled') then raise exception 'INVALID_ACCESS'; end if;
  update public.business_memberships set access=access_input
  where business_id=business_id_input and user_id=staff_id and role='staff';
  if not found then raise exception 'NOT_YOUR_STAFF_MEMBER'; end if;
end $$;

create or replace function public.delete_staff_account(staff_id uuid,business_id_input uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_business_owner(business_id_input) or not exists(select 1 from public.business_memberships where business_id=business_id_input and user_id=staff_id and role='staff') then raise exception 'NOT_YOUR_STAFF_MEMBER'; end if;
  delete from public.business_memberships where business_id=business_id_input and user_id=staff_id and role='staff';
  if exists(select 1 from public.business_memberships where user_id=staff_id) then
    update public.profiles set business_id=(select business_id from public.business_memberships where user_id=staff_id order by created_at limit 1)
    where id=staff_id and business_id=business_id_input;
  else
    delete from auth.users where id=staff_id;
  end if;
end $$;
create or replace function public.delete_staff_account(staff_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.delete_staff_account(staff_id,(select business_id from public.profiles where id=auth.uid())); end $$;

-- ---------------------------------------------------------------------------
-- 6. Public RPCs: slug resolves through businesses and every object is checked
-- against the resolved business. Existing signatures and URL arguments remain.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_campaign_signup_context(slug_input text,campaign_id_input text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; c public.campaigns%rowtype;
begin select * into b from public.businesses where slug=trim(slug_input); if not found then return null; end if;
 select * into c from public.campaigns where id=campaign_id_input and business_id=b.id; if not found then return null; end if;
 return jsonb_build_object('owner',jsonb_build_object('id',b.owner_user_id,'slug',b.slug,'businessName',b.business_name),'campaign',jsonb_build_object('id',c.id,'name',c.name,'isEnabled',c.is_enabled)); end $$;

create or replace function public.get_scan_entry_context(slug_input text,card_unique_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; ok boolean;
begin select * into b from public.businesses where slug=trim(slug_input); if not found then return null; end if;
 select exists(select 1 from public.issued_cards where unique_id=card_unique_id and business_id=b.id) into ok; if not ok then return null; end if;
 return jsonb_build_object('owner',jsonb_build_object('id',b.id,'ownerUserId',b.owner_user_id,'slug',b.slug,'businessName',b.business_name),'card',jsonb_build_object('uniqueId',card_unique_id)); end $$;

create or replace function public.get_public_card(slug_input text,card_unique_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; ic record; cu record; cp jsonb; h jsonb;
begin select * into b from public.businesses where slug=trim(slug_input); if not found then return null; end if;
 select * into ic from public.issued_cards where unique_id=card_unique_id and business_id=b.id; if not found then return null; end if;
 select * into cu from public.customers where id=ic.customer_id and business_id=b.id; if not found then return null; end if;
 select jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'reward_name',c.reward_name,'tagline',c.tagline,'background_image',c.background_image,'background_opacity',c.background_opacity,'logo_image',c.logo_image,'show_logo',c.show_logo,'title_size',c.title_size,'icon_key',c.icon_key,'colors',c.colors,'total_stamps',c.total_stamps,'social',c.social) into cp from public.campaigns c where c.id=ic.campaign_id and c.business_id=b.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'type',t.type,'amount',t.amount,'date',t.date,'timestamp',t."timestamp",'title',t.title) order by t."timestamp"),'[]'::jsonb) into h from public.transactions t where t.card_id=ic.id and t.business_id=b.id;
 return jsonb_build_object('card',jsonb_build_object('id',ic.id,'uniqueId',ic.unique_id,'campaignId',ic.campaign_id,'campaignName',ic.campaign_name,'stamps',ic.stamps,'lastVisit',ic.last_visit,'status',ic.status,'completedDate',ic.completed_date,'templateSnapshot',ic.template_snapshot,'history',h),'customer',jsonb_build_object('id',cu.id,'name',cu.name),'campaign',cp); end $$;

-- Signup implementation remains compatible and is explicitly business-scoped.
create or replace function public.register_public_campaign_signup(slug_input text,campaign_id_input text,customer_name_input text,customer_email_input text default null,customer_mobile_input text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; c public.campaigns%rowtype; cu public.customers%rowtype; old uuid; cid text; uid uuid; nm text; em text; mo text;
begin nm:=trim(coalesce(customer_name_input,'')); em:=nullif(lower(trim(coalesce(customer_email_input,''))),''); mo:=nullif(regexp_replace(coalesce(customer_mobile_input,''),'[^0-9]+','','g'),''); if nm='' then return jsonb_build_object('outcome','error','error','Name is required.'); end if;
 select * into b from public.businesses where slug=trim(slug_input); if not found then return jsonb_build_object('outcome','error','error','Business not found.'); end if;
 select * into c from public.campaigns where id=campaign_id_input and business_id=b.id; if not found then return jsonb_build_object('outcome','error','error','Campaign not found.'); end if;
 select * into cu from public.customers where business_id=b.id and ((em is not null and lower(trim(email))=em) or (mo is not null and regexp_replace(coalesce(mobile,''),'[^0-9]+','','g')=mo)) order by created_at limit 1;
 if cu.id is not null then select unique_id into old from public.issued_cards where customer_id=cu.id and campaign_id=c.id and business_id=b.id and status='Active' limit 1; if old is not null then return jsonb_build_object('outcome','redirect_existing','uniqueId',old); end if; end if;
 if c.is_enabled=false then return jsonb_build_object('outcome','campaign_disabled_no_existing'); end if;
 if cu.id is null then insert into public.customers(id,owner_id,business_id,name,email,mobile,status) values(gen_random_uuid()::text,b.owner_user_id,b.id,nm,coalesce(em,''),mo,'Active') returning * into cu; end if;
 cid:=gen_random_uuid()::text; uid:=gen_random_uuid(); insert into public.issued_cards(id,unique_id,customer_id,campaign_id,owner_id,business_id,campaign_name,stamps,last_visit,status,template_snapshot) values(cid,uid,cu.id,c.id,b.owner_user_id,b.id,c.name,0,current_date,'Active',jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'rewardName',c.reward_name,'tagline',c.tagline,'backgroundImage',c.background_image,'backgroundOpacity',c.background_opacity,'logoImage',c.logo_image,'showLogo',c.show_logo,'titleSize',c.title_size,'iconKey',c.icon_key,'colors',c.colors,'totalStamps',c.total_stamps,'social',c.social));
 insert into public.transactions(id,card_id,business_id,type,amount,date,"timestamp",title) values(gen_random_uuid()::text,cid,b.id,'issued',0,to_char(now(),'Mon FMDD, YYYY FMHH12:MI AM'),floor(extract(epoch from now())*1000)::bigint,'Card Issued'); return jsonb_build_object('outcome','issued','uniqueId',uid); end $$;

create or replace function public.delete_campaign_preserve_cards(campaign_id_input text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.campaigns%rowtype; snap jsonb;
begin
  select * into c from public.campaigns where id=campaign_id_input and public.is_business_owner(business_id);
  if not found then raise exception 'CAMPAIGN_NOT_FOUND_OR_NOT_OWNED'; end if;
  snap:=jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'rewardName',c.reward_name,'tagline',c.tagline,'backgroundImage',c.background_image,'backgroundOpacity',c.background_opacity,'logoImage',c.logo_image,'showLogo',c.show_logo,'titleSize',c.title_size,'iconKey',c.icon_key,'colors',c.colors,'totalStamps',c.total_stamps,'social',c.social);
  update public.issued_cards set template_snapshot=coalesce(template_snapshot,snap),campaign_name=coalesce(nullif(campaign_name,''),c.name),campaign_id=null
  where campaign_id=c.id and business_id=c.business_id;
  delete from public.campaigns where id=c.id and business_id=c.business_id;
  return jsonb_build_object('success',true);
end $$;

create or replace function public.delete_campaign_preserve_cards(campaign_id_input text,business_id_input uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.campaigns%rowtype; snap jsonb;
begin
  if not public.is_business_owner(business_id_input) then raise exception 'CAMPAIGN_NOT_FOUND_OR_NOT_OWNED'; end if;
  select * into c from public.campaigns where id=campaign_id_input and business_id=business_id_input;
  if not found then raise exception 'CAMPAIGN_NOT_FOUND_OR_NOT_OWNED'; end if;
  snap:=jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'rewardName',c.reward_name,'tagline',c.tagline,'backgroundImage',c.background_image,'backgroundOpacity',c.background_opacity,'logoImage',c.logo_image,'showLogo',c.show_logo,'titleSize',c.title_size,'iconKey',c.icon_key,'colors',c.colors,'totalStamps',c.total_stamps,'social',c.social);
  update public.issued_cards set template_snapshot=coalesce(template_snapshot,snap),campaign_name=coalesce(nullif(campaign_name,''),c.name),campaign_id=null
  where campaign_id=c.id and business_id=business_id_input;
  delete from public.campaigns where id=c.id and business_id=business_id_input;
  return jsonb_build_object('success',true);
end $$;

create or replace function public.inspect_scanned_card(card_unique_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); bid uuid; own boolean;
begin
  select ic.business_id into bid from public.issued_cards ic where ic.unique_id=card_unique_id;
  if bid is null then return jsonb_build_object('status','missing'); end if;
  own := public.is_business_member(bid);
  if own then return jsonb_build_object('status','owned','businessId',bid); end if;
  return jsonb_build_object('status','foreign');
end $$;

-- License keys belong to the owner account, so activation updates its profile
-- and every existing business; newly created businesses inherit the same tier.
create or replace function public.activate_license_key(key_input text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare key_row public.license_keys%rowtype; one_year_later timestamptz; uid uuid:=auth.uid();
begin
  if uid is null then return jsonb_build_object('success',false,'error','Authentication required'); end if;
  select * into key_row from public.license_keys
  where license_key=key_input and status='active' and profile_id is null
  for update;
  if not found then return jsonb_build_object('success',false,'error','Invalid or already used license key'); end if;

  one_year_later:=now()+interval '1 year';
  update public.license_keys set profile_id=uid,activated_at=now(),expires_at=one_year_later where id=key_row.id;
  perform set_config('stampee.allow_license_activation','true',true);
  update public.profiles set tier='pro',tier_expires_at=one_year_later where id=uid;
  update public.businesses set tier='pro',tier_expires_at=one_year_later where owner_user_id=uid;
  return jsonb_build_object('success',true,'expires_at',one_year_later);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Storage: new uploads use business_id as first path segment; old uid paths
-- remain readable for historical URLs and are not rewritten.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can upload own campaign assets" on storage.objects;
create policy "Users can upload own campaign assets" on storage.objects for insert
with check (bucket_id='campaign-assets' and auth.role()='authenticated' and public.is_business_owner(((storage.foldername(name))[1])::uuid));
drop policy if exists "Users can update own campaign assets" on storage.objects;
create policy "Users can update own campaign assets" on storage.objects for update
using (bucket_id='campaign-assets' and public.is_business_owner(((storage.foldername(name))[1])::uuid))
with check (bucket_id='campaign-assets' and public.is_business_owner(((storage.foldername(name))[1])::uuid));
drop policy if exists "Users can delete own campaign assets" on storage.objects;
create policy "Users can delete own campaign assets" on storage.objects for delete
using (bucket_id='campaign-assets' and public.is_business_owner(((storage.foldername(name))[1])::uuid));

-- SECURITY DEFINER functions must not inherit PostgreSQL's default PUBLIC EXECUTE.
revoke execute on function public.current_staff_owner_id() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_issuing_disabled_campaign_card() from public, anon, authenticated;
revoke execute on function public.enforce_business_slug_uniqueness() from public, anon, authenticated;
revoke execute on function public.enforce_workspace_row_identity() from public, anon, authenticated;
revoke execute on function public.enforce_profile_business_consistency() from public, anon, authenticated;
revoke execute on function public.guard_profile_sensitive_fields() from public, anon, authenticated;
revoke execute on function public.provision_owner_business_after_profile_insert() from public, anon, authenticated;
revoke execute on function public.is_business_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_business_owner(uuid) from public, anon, authenticated;
revoke execute on function public.is_business_staff(uuid) from public, anon, authenticated;
revoke execute on function public.is_business_slug_available(text) from public, anon, authenticated;
revoke execute on function public.is_slug_available(text) from public, anon, authenticated;
revoke execute on function public.create_business(text,text) from public, anon, authenticated;
revoke execute on function public.update_business_profile(uuid,text) from public, anon, authenticated;
revoke execute on function public.create_staff_account(text,text,text,uuid) from public, anon, authenticated;
revoke execute on function public.create_staff_account(text,text,text) from public, anon, authenticated;
revoke execute on function public.update_staff_pin(uuid,text,uuid) from public, anon, authenticated;
revoke execute on function public.update_staff_pin(uuid,text) from public, anon, authenticated;
revoke execute on function public.set_staff_access(uuid,text,uuid) from public, anon, authenticated;
revoke execute on function public.delete_staff_account(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.delete_staff_account(uuid) from public, anon, authenticated;
revoke execute on function public.delete_own_account() from public, anon, authenticated;
revoke execute on function public.get_public_campaign_signup_context(text,text) from public, anon, authenticated;
revoke execute on function public.get_scan_entry_context(text,uuid) from public, anon, authenticated;
revoke execute on function public.get_public_card(text,uuid) from public, anon, authenticated;
revoke execute on function public.register_public_campaign_signup(text,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.delete_campaign_preserve_cards(text) from public, anon, authenticated;
revoke execute on function public.delete_campaign_preserve_cards(text,uuid) from public, anon, authenticated;
revoke execute on function public.inspect_scanned_card(uuid) from public, anon, authenticated;
revoke execute on function public.activate_license_key(text) from public, anon, authenticated;

grant execute on function public.current_staff_owner_id() to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_owner(uuid) to authenticated;
grant execute on function public.is_business_staff(uuid) to authenticated;
grant execute on function public.is_business_slug_available(text) to anon, authenticated;
grant execute on function public.is_slug_available(text) to anon, authenticated;
grant execute on function public.create_business(text,text) to authenticated;
grant execute on function public.update_business_profile(uuid,text) to authenticated;
grant execute on function public.create_staff_account(text,text,text,uuid) to authenticated;
grant execute on function public.create_staff_account(text,text,text) to authenticated;
grant execute on function public.update_staff_pin(uuid,text,uuid) to authenticated;
grant execute on function public.update_staff_pin(uuid,text) to authenticated;
grant execute on function public.set_staff_access(uuid,text,uuid) to authenticated;
grant execute on function public.delete_staff_account(uuid,uuid) to authenticated;
grant execute on function public.delete_staff_account(uuid) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.get_public_campaign_signup_context(text,text) to anon, authenticated;
grant execute on function public.get_scan_entry_context(text,uuid) to anon, authenticated;
grant execute on function public.get_public_card(text,uuid) to anon, authenticated;
grant execute on function public.register_public_campaign_signup(text,text,text,text,text) to anon, authenticated;
grant execute on function public.delete_campaign_preserve_cards(text) to authenticated;
grant execute on function public.delete_campaign_preserve_cards(text,uuid) to authenticated;
grant execute on function public.inspect_scanned_card(uuid) to authenticated;
grant execute on function public.activate_license_key(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Invariant tests (non-destructive): these fail loudly if the migration ever
-- permits a cross-workspace row. Run the SELECTs manually after deployment too.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists(select 1 from public.issued_cards ic join public.customers c on c.id=ic.customer_id where ic.business_id<>c.business_id)
     or exists(select 1 from public.issued_cards ic join public.campaigns c on c.id=ic.campaign_id where ic.business_id<>c.business_id)
     or exists(select 1 from public.transactions t join public.issued_cards ic on ic.id=t.card_id where t.business_id<>ic.business_id) then
    raise exception 'MULTI_BUSINESS_INVARIANT_FAILED: cross-business relation';
  end if;
end $$;

-- Expected checks:
-- select business_id,count(*) from business_memberships group by business_id;
-- select count(*) from campaigns where business_id is null; -- must be 0
-- select count(*) from customers where business_id is null; -- must be 0
-- select count(*) from issued_cards where business_id is null; -- must be 0
-- select count(*) from transactions where business_id is null; -- must be 0
-- Known operational gap: this repository does not include a live Supabase
-- connection, so SQL execution/role-policy verification must be run in the
-- target project after applying migration.sql and this file.
