-- Phase 1: private platform access foundation and public-route suspension gates.
-- Additive only: does not assign or seed any platform_owner and changes no business state.
-- Apply after migration.sql, multi_business.sql, card_codes.sql, and staff_pin_fix.sql.

create schema if not exists platform_internal;
revoke all on schema platform_internal from public, anon, authenticated;
do $block$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    execute 'revoke all on schema platform_internal from service_role';
    execute 'grant usage on schema platform_internal to service_role';
  end if;
end;
$block$;

create table if not exists platform_internal.platform_memberships (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null default 'platform_owner' check (role = 'platform_owner'),
  status text not null default 'active' check (status in ('active', 'disabled')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table if not exists platform_internal.platform_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references platform_internal.platform_memberships(user_id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  mfa_verified_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

alter table platform_internal.platform_memberships enable row level security;
alter table platform_internal.platform_memberships force row level security;
alter table platform_internal.platform_sessions enable row level security;
alter table platform_internal.platform_sessions force row level security;
revoke all on table platform_internal.platform_memberships from public, anon, authenticated;
revoke all on table platform_internal.platform_sessions from public, anon, authenticated;
do $block$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    execute 'revoke all on table platform_internal.platform_memberships from service_role';
    execute 'revoke all on table platform_internal.platform_sessions from service_role';
  end if;
end;
$block$;

comment on schema platform_internal is
  'Private platform authorization and session records. No API role may read or write these tables directly.';
comment on table platform_internal.platform_memberships is
  'Explicit platform-level access only. This phase intentionally creates no memberships.';
comment on table platform_internal.platform_sessions is
  'Server-backed opaque sessions; only a SHA-256 hash of the HttpOnly cookie token is stored.';

create or replace function platform_internal.platform_create_session(p_user_id uuid, p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_user_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  if not exists (
    select 1
    from platform_internal.platform_memberships m
    where m.user_id = p_user_id
      and m.role = 'platform_owner'
      and m.status = 'active'
      and m.revoked_at is null
      and (m.expires_at is null or m.expires_at > pg_catalog.now())
  ) then
    return false;
  end if;

  insert into platform_internal.platform_sessions (token_hash, user_id, expires_at)
  values (p_token_hash, p_user_id, pg_catalog.now() + interval '30 minutes');
  return true;
exception
  when unique_violation then return false;
end;
$function$;

create or replace function platform_internal.platform_validate_session(p_token_hash text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select s.user_id
  from platform_internal.platform_sessions s
  join platform_internal.platform_memberships m on m.user_id = s.user_id
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > pg_catalog.now()
    and m.role = 'platform_owner'
    and m.status = 'active'
    and m.revoked_at is null
    and (m.expires_at is null or m.expires_at > pg_catalog.now())
  limit 1
$function$;

create or replace function platform_internal.platform_revoke_session(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare affected_rows integer;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  update platform_internal.platform_sessions
  set revoked_at = coalesce(revoked_at, pg_catalog.now())
  where token_hash = p_token_hash and revoked_at is null;
  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$function$;

create or replace function public.platform_create_session(p_user_id uuid, p_token_hash text)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select platform_internal.platform_create_session($1, $2)
$function$;

create or replace function public.platform_validate_session(p_token_hash text)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select platform_internal.platform_validate_session($1)
$function$;

create or replace function public.platform_revoke_session(p_token_hash text)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select platform_internal.platform_revoke_session($1)
$function$;

revoke all on function platform_internal.platform_create_session(uuid, text) from public, anon, authenticated;
revoke all on function platform_internal.platform_validate_session(text) from public, anon, authenticated;
revoke all on function platform_internal.platform_revoke_session(text) from public, anon, authenticated;
revoke all on function public.platform_create_session(uuid, text) from public, anon, authenticated;
revoke all on function public.platform_validate_session(text) from public, anon, authenticated;
revoke all on function public.platform_revoke_session(text) from public, anon, authenticated;
do $block$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    execute 'revoke all on function platform_internal.platform_create_session(uuid, text) from service_role';
    execute 'revoke all on function platform_internal.platform_validate_session(text) from service_role';
    execute 'revoke all on function platform_internal.platform_revoke_session(text) from service_role';
    execute 'revoke all on function public.platform_create_session(uuid, text) from service_role';
    execute 'revoke all on function public.platform_validate_session(text) from service_role';
    execute 'revoke all on function public.platform_revoke_session(text) from service_role';
    execute 'grant execute on function platform_internal.platform_create_session(uuid, text) to service_role';
    execute 'grant execute on function platform_internal.platform_validate_session(text) to service_role';
    execute 'grant execute on function platform_internal.platform_revoke_session(text) to service_role';
    execute 'grant execute on function public.platform_create_session(uuid, text) to service_role';
    execute 'grant execute on function public.platform_validate_session(text) to service_role';
    execute 'grant execute on function public.platform_revoke_session(text) to service_role';
  end if;
end;
$block$;

-- SECURITY DEFINER public RPCs bypass table RLS, so explicitly require active business access.
-- Return the same not-found shape for absent and disabled businesses to avoid status disclosure.
create or replace function public.get_public_campaign_signup_context(slug_input text, campaign_id_input text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare b public.businesses%rowtype; c public.campaigns%rowtype;
begin
  select * into b from public.businesses
  where slug = trim(slug_input) and access = 'active';
  if not found then return null; end if;

  select * into c from public.campaigns
  where id = campaign_id_input and business_id = b.id;
  if not found then return null; end if;

  return jsonb_build_object(
    'owner', jsonb_build_object('id', b.owner_user_id, 'slug', b.slug, 'businessName', b.business_name),
    'campaign', jsonb_build_object('id', c.id, 'name', c.name, 'isEnabled', c.is_enabled)
  );
end;
$function$;

create or replace function public.get_scan_entry_context(slug_input text, card_unique_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare b public.businesses%rowtype; ok boolean;
begin
  select * into b from public.businesses
  where slug = trim(slug_input) and access = 'active';
  if not found then return null; end if;

  select exists (
    select 1 from public.issued_cards
    where unique_id = card_unique_id and business_id = b.id
  ) into ok;
  if not ok then return null; end if;

  return jsonb_build_object(
    'owner', jsonb_build_object('id', b.id, 'ownerUserId', b.owner_user_id, 'slug', b.slug, 'businessName', b.business_name),
    'card', jsonb_build_object('uniqueId', card_unique_id)
  );
end;
$function$;

create or replace function public.get_public_card(slug_input text, card_unique_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare b public.businesses%rowtype; ic record; cu record; cp jsonb; h jsonb;
begin
  select * into b from public.businesses
  where slug = trim(slug_input) and access = 'active';
  if not found then return null; end if;

  select * into ic from public.issued_cards
  where unique_id = card_unique_id and business_id = b.id;
  if not found then return null; end if;

  select * into cu from public.customers
  where id = ic.customer_id and business_id = b.id;
  if not found then return null; end if;

  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'reward_name', c.reward_name,
    'tagline', c.tagline, 'background_image', c.background_image,
    'background_opacity', c.background_opacity, 'logo_image', c.logo_image,
    'show_logo', c.show_logo, 'title_size', c.title_size, 'icon_key', c.icon_key,
    'colors', c.colors, 'total_stamps', c.total_stamps, 'social', c.social
  ) into cp
  from public.campaigns c
  where c.id = ic.campaign_id and c.business_id = b.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'type', t.type, 'amount', t.amount, 'date', t.date,
    'timestamp', t."timestamp", 'title', t.title
  ) order by t."timestamp"), '[]'::jsonb) into h
  from public.transactions t
  where t.card_id = ic.id and t.business_id = b.id;

  return jsonb_build_object(
    'card', jsonb_build_object(
      'id', ic.id, 'uniqueId', ic.unique_id, 'cardCode', ic.card_code,
      'campaignId', ic.campaign_id, 'campaignName', ic.campaign_name,
      'stamps', ic.stamps, 'lastVisit', ic.last_visit, 'status', ic.status,
      'completedDate', ic.completed_date, 'templateSnapshot', ic.template_snapshot, 'history', h
    ),
    'customer', jsonb_build_object('id', cu.id, 'name', cu.name),
    'campaign', cp
  );
end;
$function$;

create or replace function public.register_public_campaign_signup(
  slug_input text,
  campaign_id_input text,
  customer_name_input text,
  customer_email_input text default null,
  customer_mobile_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  b public.businesses%rowtype;
  c public.campaigns%rowtype;
  cu public.customers%rowtype;
  old uuid;
  cid text;
  uid uuid;
  nm text;
  em text;
  mo text;
begin
  nm := trim(coalesce(customer_name_input, ''));
  em := nullif(lower(trim(coalesce(customer_email_input, ''))), '');
  mo := nullif(regexp_replace(coalesce(customer_mobile_input, ''), '[^0-9]+', '', 'g'), '');
  if nm = '' then return jsonb_build_object('outcome', 'error', 'error', 'Name is required.'); end if;

  select * into b from public.businesses
  where slug = trim(slug_input) and access = 'active';
  if not found then return jsonb_build_object('outcome', 'error', 'error', 'Business not found.'); end if;

  select * into c from public.campaigns
  where id = campaign_id_input and business_id = b.id;
  if not found then return jsonb_build_object('outcome', 'error', 'error', 'Campaign not found.'); end if;

  select * into cu from public.customers
  where business_id = b.id
    and ((em is not null and lower(trim(email)) = em)
      or (mo is not null and regexp_replace(coalesce(mobile, ''), '[^0-9]+', '', 'g') = mo))
  order by created_at
  limit 1;

  if cu.id is not null then
    select unique_id into old from public.issued_cards
    where customer_id = cu.id and campaign_id = c.id and business_id = b.id and status = 'Active'
    limit 1;
    if old is not null then return jsonb_build_object('outcome', 'redirect_existing', 'uniqueId', old); end if;
  end if;

  if c.is_enabled = false then return jsonb_build_object('outcome', 'campaign_disabled_no_existing'); end if;
  if cu.id is null then
    insert into public.customers(id, owner_id, business_id, name, email, mobile, status)
    values (gen_random_uuid()::text, b.owner_user_id, b.id, nm, coalesce(em, ''), mo, 'Active')
    returning * into cu;
  end if;

  cid := gen_random_uuid()::text;
  uid := gen_random_uuid();
  insert into public.issued_cards(
    id, unique_id, customer_id, campaign_id, owner_id, business_id, campaign_name,
    stamps, last_visit, status, template_snapshot
  ) values (
    cid, uid, cu.id, c.id, b.owner_user_id, b.id, c.name, 0, current_date, 'Active',
    jsonb_build_object(
      'id', c.id, 'name', c.name, 'description', c.description, 'rewardName', c.reward_name,
      'tagline', c.tagline, 'backgroundImage', c.background_image,
      'backgroundOpacity', c.background_opacity, 'logoImage', c.logo_image,
      'showLogo', c.show_logo, 'titleSize', c.title_size, 'iconKey', c.icon_key,
      'colors', c.colors, 'totalStamps', c.total_stamps, 'social', c.social
    )
  );
  insert into public.transactions(id, card_id, business_id, type, amount, date, "timestamp", title)
  values (
    gen_random_uuid()::text, cid, b.id, 'issued', 0,
    to_char(pg_catalog.now(), 'Mon FMDD, YYYY FMHH12:MI AM'),
    floor(extract(epoch from pg_catalog.now()) * 1000)::bigint, 'Card Issued'
  );
  return jsonb_build_object('outcome', 'issued', 'uniqueId', uid);
end;
$function$;

revoke execute on function public.get_public_campaign_signup_context(text, text) from public, anon, authenticated;
revoke execute on function public.get_scan_entry_context(text, uuid) from public, anon, authenticated;
revoke execute on function public.get_public_card(text, uuid) from public, anon, authenticated;
revoke execute on function public.register_public_campaign_signup(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_public_campaign_signup_context(text, text) to anon, authenticated;
grant execute on function public.get_scan_entry_context(text, uuid) to anon, authenticated;
grant execute on function public.get_public_card(text, uuid) to anon, authenticated;
grant execute on function public.register_public_campaign_signup(text, text, text, text, text) to anon, authenticated;
