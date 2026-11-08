\set ON_ERROR_STOP on
\set QUIET 1
-- LOCAL ONLY: canonical migrations + setup_local.sql; no real credentials.
begin;
create temporary table fixture(owner_id uuid, other_owner_id uuid, business_id uuid,
  other_business_id uuid, staff_id uuid, legacy_staff_id uuid) on commit drop;
grant select, update on fixture to authenticated;
insert into fixture values (
  '11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',null,
  '22222222-2222-4222-8222-222222222222');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  confirmation_token,recovery_token,email_change_token_new,email_change,raw_user_meta_data,
  raw_app_meta_data,created_at,updated_at,is_sso_user)
values ('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','synthetic-other-owner@example.test',
  extensions.crypt('synthetic-owner-secret',extensions.gen_salt('bf')),now(),'','','','',
  jsonb_build_object('business_name','SYNTHETIC OTHER OWNER','slug','synthetic-other-owner'),
  jsonb_build_object('provider','email','providers',jsonb_build_array('email')),now(),now(),false);
create temporary table owner_auth_before on commit drop as
  select id, encrypted_password, confirmation_token from auth.users
  where id in (select owner_id from fixture union select other_owner_id from fixture);

-- Complete legacy NULL repair, with the previous PIN verifier retained.
do $$
begin
  if not exists(select 1 from auth.users u where u.id=(select legacy_staff_id from fixture)
    and u.confirmation_token='' and u.recovery_token=''
    and u.email_change_token_new='' and u.email_change=''
    and u.encrypted_password=extensions.crypt('0007',u.encrypted_password)) then
    raise exception 'TEST_FAIL_BACKFILL_STAFF_CONTRACT';
  end if;
  if exists(select 1 from auth.users u join owner_auth_before o using(id)
    where u.encrypted_password is distinct from o.encrypted_password
      or u.confirmation_token is distinct from o.confirmation_token) then
    raise exception 'TEST_FAIL_OWNER_AUTH_MUTATED';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',(select owner_id::text from fixture),false);
do $$
begin
  begin perform id from auth.users limit 1;
    raise exception 'TEST_FAIL_AUTH_USERS_READABLE';
  exception when insufficient_privilege then null; end;
end $$;
select public.create_staff_account('  SYNTHETIC-NEW-STAFF@EXAMPLE.TEST  ','0007','SYNTHETIC STAFF',
  (select business_id from fixture));
reset role;
update fixture set staff_id=(select id from auth.users where email='synthetic-new-staff@example.test');
do $$
begin
  if not exists(select 1 from auth.users u where u.id=(select staff_id from fixture)
      and u.confirmation_token='' and u.recovery_token=''
      and u.email_change_token_new='' and u.email_change=''
      and u.email_confirmed_at is not null
      and u.encrypted_password=extensions.crypt('0007',u.encrypted_password)
      and substring(u.encrypted_password,5,2)='10') then
    raise exception 'TEST_FAIL_NEW_STAFF_AUTH_CONTRACT';
  end if;
  if not exists(select 1 from auth.identities i where i.user_id=(select staff_id from fixture)
      and i.provider='email' and i.identity_data->>'email'='synthetic-new-staff@example.test') then
    raise exception 'TEST_FAIL_STAFF_EMAIL_IDENTITY';
  end if;
end $$;

insert into auth.sessions(user_id) values ((select staff_id from fixture));
set role authenticated;
select public.update_staff_pin((select staff_id from fixture),'0042',(select business_id from fixture));
reset role;
do $$
begin
  if not exists(select 1 from auth.users where id=(select staff_id from fixture)
      and encrypted_password=extensions.crypt('0042',encrypted_password)
      and encrypted_password<>extensions.crypt('0007',encrypted_password)) then
    raise exception 'TEST_FAIL_PIN_ROTATION';
  end if;
  if exists(select 1 from auth.sessions where user_id=(select staff_id from fixture)) then
    raise exception 'TEST_FAIL_SESSION_REVOCATION';
  end if;
end $$;
set role authenticated;
select public.update_staff_pin((select staff_id from fixture),'00042',(select business_id from fixture));
reset role;
do $$ begin
  if not exists(select 1 from auth.users where id=(select staff_id from fixture)
    and encrypted_password=extensions.crypt('00042',encrypted_password)) then
    raise exception 'TEST_FAIL_FIVE_DIGIT_PIN'; end if;
end $$;
set role authenticated;
select public.update_staff_pin((select staff_id from fixture),'000042',(select business_id from fixture));
reset role;
do $$ begin
  if not exists(select 1 from auth.users where id=(select staff_id from fixture)
    and encrypted_password=extensions.crypt('000042',encrypted_password)) then
    raise exception 'TEST_FAIL_SIX_DIGIT_PIN'; end if;
end $$;

set role authenticated;
do $$ begin
  begin perform public.update_staff_pin((select staff_id from fixture),null,(select business_id from fixture));
    raise exception 'TEST_FAIL_NULL_PIN_ACCEPTED';
  exception when others then if sqlerrm not like 'PIN_MUST_BE_4_6_DIGITS%' then raise; end if; end;
  begin perform public.update_staff_pin((select owner_id from fixture),'1234',(select business_id from fixture));
    raise exception 'TEST_FAIL_OWNER_TARGET_ACCEPTED';
  exception when others then if sqlerrm not like 'NOT_YOUR_STAFF_MEMBER%' then raise; end if; end;
  begin perform public.update_staff_pin((select staff_id from fixture),'1234',(select other_business_id from fixture));
    raise exception 'TEST_FAIL_WRONG_BUSINESS_ACCEPTED';
  exception when others then if sqlerrm not like 'NOT_YOUR_STAFF_MEMBER%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',(select other_owner_id::text from fixture),false);
do $$ begin
  begin perform public.update_staff_pin((select staff_id from fixture),'1234',(select business_id from fixture));
    raise exception 'TEST_FAIL_NONOWNER_ACCEPTED';
  exception when others then if sqlerrm not like 'NOT_YOUR_STAFF_MEMBER%' then raise; end if; end;
end $$;
reset role;
-- A foreign owner cannot reset another owner's global staff Auth identity,
-- even if a future invitation gives that staff membership in both businesses.
insert into public.business_memberships(business_id,user_id,role)
  select other_business_id,staff_id,'staff' from fixture;
set role authenticated;
do $$ begin
  begin perform public.update_staff_pin((select staff_id from fixture),'1234',(select other_business_id from fixture));
    raise exception 'TEST_FAIL_FOREIGN_OWNER_GLOBAL_PIN_RESET';
  exception when others then if sqlerrm not like 'NOT_STAMPEE_STAFF_ACCOUNT%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',(select owner_id::text from fixture),false);
select public.set_staff_access((select staff_id from fixture),'disabled',(select business_id from fixture));
select set_config('request.jwt.claim.sub',(select staff_id::text from fixture),false);
do $$ begin
  if public.is_business_staff((select business_id from fixture))
    or public.is_business_member((select business_id from fixture)) then
    raise exception 'TEST_FAIL_DISABLED_STAFF_SCOPE'; end if;
  begin perform public.update_staff_pin((select staff_id from fixture),'1234',(select business_id from fixture));
    raise exception 'TEST_FAIL_STAFF_SELF_RESET';
  exception when others then if sqlerrm not like 'NOT_YOUR_STAFF_MEMBER%' then raise; end if; end;
end $$;
reset role;

-- Re-run the actual additive backfill on a mixed NULL/non-NULL staff row.
update auth.users set confirmation_token='keep-confirm',recovery_token=null,
  email_change_token_new='keep-change-new',email_change='keep-change'
  where id=(select legacy_staff_id from fixture);
\ir ../staff_pin_fix.sql
do $$ begin
  if not exists(select 1 from auth.users where id=(select legacy_staff_id from fixture)
    and confirmation_token='keep-confirm' and recovery_token=''
    and email_change_token_new='keep-change-new' and email_change='keep-change') then
    raise exception 'TEST_FAIL_NON_NULL_AUTH_TOKEN_PRESERVATION'; end if;
end $$;
-- Invalid marker text must not cause a UUID cast error, nor authorize a repair.
update auth.users set raw_app_meta_data=jsonb_set(raw_app_meta_data,
  '{stampee_owner_user_id}','"not-a-uuid"'),recovery_token=null
  where id=(select legacy_staff_id from fixture);
-- An owner remains an owner even if privileged metadata was incorrectly marked.
update auth.users set raw_app_meta_data=jsonb_build_object('stampee_staff_provisioned',true,
  'stampee_business_id',id,'stampee_owner_user_id',id),confirmation_token=null
  where id=(select owner_id from fixture);
\ir ../staff_pin_fix.sql
do $$ begin
  if (select recovery_token from auth.users where id=(select legacy_staff_id from fixture)) is not null then
    raise exception 'TEST_FAIL_INVALID_STAFF_MARKER_REPAIRED'; end if;
  if (select confirmation_token from auth.users where id=(select owner_id from fixture)) is not null then
    raise exception 'TEST_FAIL_OWNER_NULL_TOKEN_REPAIRED'; end if;
  if exists(select 1 from auth.users u join owner_auth_before o using(id)
    where u.encrypted_password is distinct from o.encrypted_password) then
    raise exception 'TEST_FAIL_OWNER_VERIFIER_CHANGED'; end if;
end $$;
rollback;
reset role;
select 'STAFF_PIN_TESTS_OK' as result;
