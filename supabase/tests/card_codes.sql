\set ON_ERROR_STOP on
\set QUIET 1
-- LOCAL ONLY. All fixtures are synthetic; every change is rolled back.
begin;
create temporary table card_fixture(card_id text,business_id uuid,owner_id uuid,
  staff_id uuid,unique_id uuid,card_code text,other_business_id uuid) on commit drop;
insert into card_fixture
select id,business_id,owner_id,'22222222-2222-4222-8222-222222222222',unique_id,card_code,null
from public.issued_cards where id='synthetic-card';
grant select,update on card_fixture to authenticated;
do $$ begin
  if not exists(select 1 from card_fixture where unique_id='44444444-4444-4444-8444-444444444444'
    and business_id='11111111-1111-4111-8111-111111111111'
    and card_code ~ '^[a-z0-9]{4}-[a-z0-9]{4}$') then
    raise exception 'TEST_FAIL_LEGACY_BACKFILL_OR_IDENTITY'; end if;
  if not exists(select 1 from stampee_private.card_code_registry
    where code=(select card_code from card_fixture)) then
    raise exception 'TEST_FAIL_BACKFILL_LEDGER'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',(select owner_id::text from card_fixture),false);
update card_fixture set other_business_id=public.create_business('SYNTHETIC SECOND BUSINESS','synthetic-second');
do $$
declare r jsonb;
begin
  begin insert into public.issued_cards(id,unique_id,customer_id,campaign_id,owner_id,business_id,
    campaign_name,stamps,last_visit,status,card_code)
    values('synthetic-client-card',gen_random_uuid(),'synthetic-customer','synthetic-campaign',
      (select owner_id from card_fixture),(select business_id from card_fixture),
      'SYNTHETIC',0,current_date,'Active','aaaa-bbbb');
    raise exception 'TEST_FAIL_CLIENT_CODE_ACCEPTED';
  exception when others then if sqlerrm not like 'CARD_CODE_CLIENT_SUPPLIED%' then raise; end if; end;
  begin update public.issued_cards set card_code='aaaa-bbbb' where id='synthetic-card';
    raise exception 'TEST_FAIL_CODE_MUTABLE';
  exception when others then if sqlerrm not like 'CARD_CODE_IS_IMMUTABLE%' then raise; end if; end;
  begin perform code from stampee_private.card_code_registry limit 1;
    raise exception 'TEST_FAIL_PRIVATE_LEDGER_READABLE';
  exception when insufficient_privilege then null; end;
  r:=public.resolve_staff_card_code((select business_id from card_fixture),
    upper(replace((select card_code from card_fixture),'-',' ')));
  if r->>'uniqueId' is distinct from (select unique_id::text from card_fixture) then
    raise exception 'TEST_FAIL_OWNER_RESOLVER'; end if;
  if public.resolve_staff_card_code((select other_business_id from card_fixture),
    (select card_code from card_fixture)) is not null then
    raise exception 'TEST_FAIL_CROSS_WORKSPACE_LOOKUP'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select staff_id::text from card_fixture),false);
do $$ begin
  if public.resolve_staff_card_code((select business_id from card_fixture),
    (select card_code from card_fixture)) is null then raise exception 'TEST_FAIL_STAFF_RESOLVER'; end if;
  if public.resolve_staff_card_code((select other_business_id from card_fixture),
    (select card_code from card_fixture)) is not null then raise exception 'TEST_FAIL_FOREIGN_STAFF_LOOKUP'; end if;
end $$;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
  if public.resolve_staff_card_code((select business_id from card_fixture),
    (select card_code from card_fixture)) is not null then raise exception 'TEST_FAIL_EMPTY_UID_RESOLVER'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select owner_id::text from card_fixture),false);
select public.set_staff_access((select staff_id from card_fixture),'disabled',(select business_id from card_fixture));
select set_config('request.jwt.claim.sub',(select staff_id::text from card_fixture),false);
do $$ begin
  if public.resolve_staff_card_code((select business_id from card_fixture),
    (select card_code from card_fixture)) is not null then raise exception 'TEST_FAIL_DISABLED_STAFF_LOOKUP'; end if;
end $$;
reset role;
update public.businesses set access='disabled' where id=(select business_id from card_fixture);
set role authenticated;
select set_config('request.jwt.claim.sub',(select owner_id::text from card_fixture),false);
do $$ begin
  if public.resolve_staff_card_code((select business_id from card_fixture),
    (select card_code from card_fixture)) is not null then raise exception 'TEST_FAIL_DISABLED_BUSINESS_LOOKUP'; end if;
end $$;
reset role;
update public.businesses set access='active' where id=(select business_id from card_fixture);

-- Public UUID routes and public signup remain compatible, but code lookup is staff-only.
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$
declare r jsonb; signup jsonb;
begin
  begin perform public.resolve_staff_card_code('11111111-1111-4111-8111-111111111111','aaaa-bbbb');
    raise exception 'TEST_FAIL_ANON_RESOLVER_EXECUTE';
  exception when insufficient_privilege then null; end;
  r:=public.get_public_card('synthetic-owner','44444444-4444-4444-8444-444444444444');
  if r is null or r->'card'->>'uniqueId' is distinct from '44444444-4444-4444-8444-444444444444'
    or coalesce(r->'card'->>'cardCode','') !~ '^[a-z0-9]{4}-[a-z0-9]{4}$' then
    raise exception 'TEST_FAIL_PUBLIC_UUID_PAYLOAD'; end if;
  if public.get_public_campaign_signup_context('synthetic-owner','synthetic-campaign') is null then
    raise exception 'TEST_FAIL_PUBLIC_SIGNUP_CONTEXT'; end if;
  if public.get_scan_entry_context('synthetic-owner','44444444-4444-4444-8444-444444444444') is null then
    raise exception 'TEST_FAIL_PUBLIC_SCAN_CONTEXT'; end if;
  if public.get_public_card('synthetic-second','44444444-4444-4444-8444-444444444444') is not null then
    raise exception 'TEST_FAIL_PUBLIC_WRONG_SLUG'; end if;
  signup:=public.register_public_campaign_signup('synthetic-owner','synthetic-campaign',
    'SYNTHETIC PUBLIC CUSTOMER','synthetic-public@example.test',null);
  if signup->>'outcome' is distinct from 'issued' then raise exception 'TEST_FAIL_PUBLIC_SIGNUP'; end if;
  r:=public.get_public_card('synthetic-owner',(signup->>'uniqueId')::uuid);
  if r is null or coalesce(r->'card'->>'cardCode','') !~ '^[a-z0-9]{4}-[a-z0-9]{4}$' then
    raise exception 'TEST_FAIL_PUBLIC_SIGNUP_CODE'; end if;
end $$;
reset role;
update public.businesses set access='disabled' where id=(select business_id from card_fixture);
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$
declare r jsonb; signup jsonb;
begin
  if public.get_public_card('synthetic-owner','44444444-4444-4444-8444-444444444444') is not null then
    raise exception 'TEST_FAIL_DISABLED_PUBLIC_CARD'; end if;
  if public.get_public_campaign_signup_context('synthetic-owner','synthetic-campaign') is not null then
    raise exception 'TEST_FAIL_DISABLED_SIGNUP_CONTEXT'; end if;
  if public.get_scan_entry_context('synthetic-owner','44444444-4444-4444-8444-444444444444') is not null then
    raise exception 'TEST_FAIL_DISABLED_SCAN_CONTEXT'; end if;
  signup:=public.register_public_campaign_signup('synthetic-owner','synthetic-campaign',
    'SYNTHETIC SUSPENDED SIGNUP','synthetic-suspended@example.test',null);
  if signup->>'outcome' is distinct from 'error' then
    raise exception 'TEST_FAIL_DISABLED_PUBLIC_SIGNUP'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.customers where email='synthetic-suspended@example.test') then
    raise exception 'TEST_FAIL_DISABLED_SIGNUP_CREATED_CUSTOMER'; end if;
  if exists(select 1 from public.issued_cards where customer_id in
      (select id from public.customers where email='synthetic-suspended@example.test')) then
    raise exception 'TEST_FAIL_DISABLED_SIGNUP_CREATED_CARD'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',(select staff_id::text from card_fixture),false);
do $$ begin
  if public.inspect_scanned_card('44444444-4444-4444-8444-444444444444')->>'status' is distinct from 'foreign' then
    raise exception 'TEST_FAIL_DISABLED_AUTHENTICATED_SCAN'; end if;
end $$;
reset role;
update public.businesses set access='active' where id=(select business_id from card_fixture);

do $$
begin
  if exists(select 1 from platform_internal.platform_memberships) then
    raise exception 'TEST_FAIL_PLATFORM_MEMBERSHIP_WAS_SEEDED'; end if;
  if exists(select 1 from platform_internal.platform_sessions) then
    raise exception 'TEST_FAIL_PLATFORM_SESSION_WAS_SEEDED'; end if;
  if has_table_privilege('anon','platform_internal.platform_memberships','select')
    or has_table_privilege('authenticated','platform_internal.platform_memberships','select')
    or has_table_privilege('anon','platform_internal.platform_sessions','select')
    or has_table_privilege('authenticated','platform_internal.platform_sessions','select') then
    raise exception 'TEST_FAIL_PLATFORM_TABLE_EXPOSED'; end if;
  if has_function_privilege('anon','public.platform_create_session(uuid,text)','execute')
    or has_function_privilege('authenticated','public.platform_create_session(uuid,text)','execute')
    or has_function_privilege('anon','public.platform_validate_session(text)','execute')
    or has_function_privilege('authenticated','public.platform_validate_session(text)','execute')
    or has_function_privilege('anon','public.platform_revoke_session(text)','execute')
    or has_function_privilege('authenticated','public.platform_revoke_session(text)','execute') then
    raise exception 'TEST_FAIL_PLATFORM_SESSION_RPC_EXPOSED'; end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid='platform_internal.platform_memberships'::regclass)
    or not (select relrowsecurity and relforcerowsecurity from pg_class where oid='platform_internal.platform_sessions'::regclass) then
    raise exception 'TEST_FAIL_PLATFORM_RLS_NOT_FORCED'; end if;
end $$;

insert into public.issued_cards(id,unique_id,customer_id,campaign_id,owner_id,business_id,
  campaign_name,stamps,last_visit,status)
select 'synthetic-batch-'||n,gen_random_uuid(),'synthetic-customer','synthetic-campaign',
  owner_id,business_id,'SYNTHETIC BATCH',0,current_date,'Active'
from card_fixture cross join generate_series(1,32) n;
do $$ begin
  if exists(select 1 from public.issued_cards where card_code is null
    or card_code !~ '^[a-z0-9]{4}-[a-z0-9]{4}$') then raise exception 'TEST_FAIL_GENERATED_FORMAT'; end if;
  if exists(select card_code from public.issued_cards group by card_code having count(*)>1) then
    raise exception 'TEST_FAIL_GENERATED_UNIQUENESS'; end if;
end $$;
delete from public.issued_cards where id='synthetic-card';
do $$ begin
  if not exists(select 1 from stampee_private.card_code_registry
    where code=(select card_code from card_fixture)) then raise exception 'TEST_FAIL_DELETED_CODE_RELEASED'; end if;
end $$;

-- Force exactly the first candidate to collide; subsequent entropy uses the real builtin.
insert into stampee_private.card_code_registry(code) values('aaaa-aaaa') on conflict do nothing;
create sequence stampee_private.test_rng_calls;
create or replace function extensions.gen_random_uuid() returns uuid
language plpgsql volatile set search_path='' as $$ begin
  if nextval('stampee_private.test_rng_calls')<=8 then
    return '00000000-0000-4000-8000-000000000000'::uuid;
  end if;
  return pg_catalog.gen_random_uuid();
end $$;
do $$
declare generated text; before_count bigint; rolled_back_code text;
begin
  generated:=stampee_private.allocate_card_code();
  if generated='aaaa-aaaa' or (select last_value from stampee_private.test_rng_calls)<16
    or not exists(select 1 from stampee_private.card_code_registry where code=generated) then
    raise exception 'TEST_FAIL_COLLISION_RETRY'; end if;
  select count(*) into before_count from stampee_private.card_code_registry;
  begin
    rolled_back_code:=stampee_private.allocate_card_code();
    raise exception using errcode='PT001',message='SYNTHETIC_ROLLBACK';
  exception when sqlstate 'PT001' then null; end;
  if (select count(*) from stampee_private.card_code_registry)<>before_count
    or exists(select 1 from stampee_private.card_code_registry where code=rolled_back_code) then
    raise exception 'TEST_FAIL_REGISTRY_ROLLBACK'; end if;
end $$;
rollback;
reset role;
select 'CARD_CODE_TESTS_OK' as result;
