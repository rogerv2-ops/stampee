-- Stampee card codes: additive server-owned short identifiers.
-- Apply after migration.sql and multi_business.sql. This file intentionally has
-- no transaction wrapper; Supabase applies migrations transactionally.

create schema if not exists stampee_private;

create table if not exists stampee_private.card_code_registry (
  code text primary key check (code ~ '^[a-z0-9]{4}-[a-z0-9]{4}$'),
  allocated_at timestamptz not null default pg_catalog.now()
);

revoke all on schema stampee_private from public, anon, authenticated;
revoke all on stampee_private.card_code_registry from public, anon, authenticated;
alter table stampee_private.card_code_registry enable row level security;
drop policy if exists card_code_registry_deny_all on stampee_private.card_code_registry;
create policy card_code_registry_deny_all
  on stampee_private.card_code_registry
  for all to public
  using (false)
  with check (false);

-- Every byte used below is one of the random UUID bytes. UUID v4's fixed version
-- and variant bytes (zero-based offsets 6 and 8) are deliberately not sampled.
create or replace function stampee_private.allocate_card_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  sample bytea;
  candidate integer;
  position_index integer;
  result text := '';
  reserved integer;
  attempts integer;
begin
  for attempts in 1..64 loop
    result := '';
    for position_index in 0..7 loop
      loop
        sample := pg_catalog.uuid_send(extensions.gen_random_uuid());
        candidate := pg_catalog.get_byte(sample, case when position_index < 6 then position_index when position_index = 6 then 7 else 9 end);
        exit when candidate < 252;
      end loop;
      result := result || pg_catalog.substr(alphabet, (candidate % 36) + 1, 1);
    end loop;
    result := pg_catalog.substr(result, 1, 4) || '-' || pg_catalog.substr(result, 5, 4);

    insert into stampee_private.card_code_registry(code)
      values (result)
      on conflict (code) do nothing;
    get diagnostics reserved = row_count;
    if reserved = 1 then
      return result;
    end if;
  end loop;
  raise exception 'CARD_CODE_ALLOCATION_EXHAUSTED';
end;
$$;
revoke all on function stampee_private.allocate_card_code() from public, anon, authenticated;

-- Add nullable first so old rows can be allocated before the NOT NULL guard.
alter table public.issued_cards add column if not exists card_code text;

-- During the one-time backfill only, the insert-side trigger is already enough
-- to enforce that clients cannot provide a code; the update guard is installed
-- only after all legacy rows have a reserved code.
drop trigger if exists issued_cards_card_code_insert on public.issued_cards;
create or replace function stampee_private.assign_insert_card_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.card_code is not null then
    raise exception 'CARD_CODE_CLIENT_SUPPLIED';
  end if;
  new.card_code := stampee_private.allocate_card_code();
  return new;
end;
$$;
revoke all on function stampee_private.assign_insert_card_code() from public, anon, authenticated;
create trigger issued_cards_card_code_insert
  before insert on public.issued_cards
  for each row execute function stampee_private.assign_insert_card_code();

update public.issued_cards
set card_code = stampee_private.allocate_card_code()
where card_code is null;

alter table public.issued_cards alter column card_code set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.issued_cards'::regclass
      and conname = 'issued_cards_card_code_format'
  ) then
    alter table public.issued_cards add constraint issued_cards_card_code_format
      check (card_code ~ '^[a-z0-9]{4}-[a-z0-9]{4}$');
  end if;
end;
$$;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.issued_cards'::regclass
      and conname = 'issued_cards_card_code_key'
  ) then
    alter table public.issued_cards add constraint issued_cards_card_code_key unique (card_code);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.issued_cards'::regclass
      and conname = 'issued_cards_card_code_registry_fk'
  ) then
    alter table public.issued_cards add constraint issued_cards_card_code_registry_fk
      foreign key (card_code) references stampee_private.card_code_registry(code);
  end if;
end;
$$;

create or replace function stampee_private.guard_card_code_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.card_code is distinct from old.card_code then
    raise exception 'CARD_CODE_IS_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function stampee_private.guard_card_code_update() from public, anon, authenticated;
drop trigger if exists issued_cards_card_code_update on public.issued_cards;
create trigger issued_cards_card_code_update
  before update of card_code on public.issued_cards
  for each row execute function stampee_private.guard_card_code_update();

-- Existing public URL/QR lookup remains the same (slug, UUID); only card.cardCode
-- is added to its prior full payload. Its public grants remain intentionally kept.
create or replace function public.get_public_card(slug_input text, card_unique_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare b public.businesses%rowtype; ic record; cu record; cp jsonb; h jsonb;
begin
  select * into b from public.businesses where slug=trim(slug_input);
  if not found then return null; end if;
  select * into ic from public.issued_cards
    where unique_id=card_unique_id and business_id=b.id;
  if not found then return null; end if;
  select * into cu from public.customers
    where id=ic.customer_id and business_id=b.id;
  if not found then return null; end if;
  select jsonb_build_object(
    'id',c.id,'name',c.name,'description',c.description,'reward_name',c.reward_name,
    'tagline',c.tagline,'background_image',c.background_image,
    'background_opacity',c.background_opacity,'logo_image',c.logo_image,
    'show_logo',c.show_logo,'title_size',c.title_size,'icon_key',c.icon_key,
    'colors',c.colors,'total_stamps',c.total_stamps,'social',c.social) into cp
    from public.campaigns c where c.id=ic.campaign_id and c.business_id=b.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'type',t.type,'amount',t.amount,'date',t.date,
    'timestamp',t."timestamp",'title',t.title) order by t."timestamp"),'[]'::jsonb) into h
    from public.transactions t where t.card_id=ic.id and t.business_id=b.id;
  return jsonb_build_object(
    'card',jsonb_build_object('id',ic.id,'uniqueId',ic.unique_id,
      'cardCode',ic.card_code,'campaignId',ic.campaign_id,
      'campaignName',ic.campaign_name,'stamps',ic.stamps,'lastVisit',ic.last_visit,
      'status',ic.status,'completedDate',ic.completed_date,
      'templateSnapshot',ic.template_snapshot,'history',h),
    'customer',jsonb_build_object('id',cu.id,'name',cu.name),'campaign',cp);
end;
$$;
revoke execute on function public.get_public_card(text,uuid) from public, anon, authenticated;
grant execute on function public.get_public_card(text,uuid) to anon, authenticated;

create or replace function public.resolve_staff_card_code(
  business_id_input uuid,
  card_code_input text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare normalized text;
begin
  if auth.uid() is null then return null; end if;
  normalized := lower(regexp_replace(trim(coalesce(card_code_input,'')), '[-[:space:]]', '', 'g'));
  if normalized !~ '^[a-z0-9]{8}$' then return null; end if;
  if not public.is_business_member(business_id_input) then return null; end if;
  return (
    select jsonb_build_object('uniqueId',ic.unique_id,'cardCode',ic.card_code)
    from public.issued_cards ic
    where ic.business_id=business_id_input
      and ic.card_code=substr(normalized, 1, 4) || '-' || substr(normalized, 5, 4)
    limit 1
  );
end;
$$;
revoke execute on function public.resolve_staff_card_code(uuid,text) from public, anon;
grant execute on function public.resolve_staff_card_code(uuid,text) to authenticated;
