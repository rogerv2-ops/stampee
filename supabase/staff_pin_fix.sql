-- Staff PIN auth repair (additive, business-scoped).
-- Only staff accounts provisioned by Stampee are touched. Owner auth rows are never modified.

create or replace function public.create_staff_account(
  staff_email text,
  staff_pin text,
  staff_name text,
  business_id_input uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_uid uuid := gen_random_uuid();
  v_owner uuid := auth.uid();
  v_email text := lower(trim(staff_email));
begin
  if not public.is_business_owner(business_id_input) then
    raise exception 'ONLY_BUSINESS_OWNER';
  end if;
  if staff_pin is null or staff_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN_MUST_BE_4_6_DIGITS';
  end if;
  if v_email is null or v_email = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'EMAIL_ALREADY_IN_USE';
  end if;

  -- Keep the auth row compatible with GoTrue's email-password contract.
  -- Empty token values mean "no pending token"; NULL is not used for staff rows.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change,
    raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at, is_sso_user
  ) values (
    new_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(staff_pin, extensions.gen_salt('bf', 10)),
    now(),
    '', '', '', '',
    jsonb_build_object('business_name', trim(coalesce(staff_name, ''))),
    jsonb_build_object(
      'provider', 'email',
      'providers', array_to_json(array['email']),
      'stampee_staff_provisioned', true,
      'stampee_business_id', business_id_input,
      'stampee_owner_user_id', v_owner
    ),
    now(), now(), false
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    new_uid, new_uid,
    jsonb_build_object('sub', new_uid::text, 'email', v_email),
    'email', new_uid::text, now(), now(), now()
  );

  insert into public.business_memberships (business_id, user_id, role)
  values (business_id_input, new_uid, 'staff');
  return new_uid;
end;
$$;

create or replace function public.update_staff_pin(
  staff_id uuid,
  new_pin text,
  business_id_input uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_business_owner(business_id_input)
     or not exists (
       select 1
       from public.business_memberships
       where business_id = business_id_input
         and user_id = staff_id
         and role = 'staff'
     ) then
    raise exception 'NOT_YOUR_STAFF_MEMBER';
  end if;
  if new_pin is null or new_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN_MUST_BE_4_6_DIGITS';
  end if;
  if not exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    join public.businesses b on b.id = business_id_input
    where u.id = staff_id
      and p.role = 'staff'
      and p.owner_id = b.owner_user_id
      and u.raw_app_meta_data->>'stampee_staff_provisioned' = 'true'
      and lower(u.raw_app_meta_data->>'stampee_owner_user_id') = b.owner_user_id::text
  ) then
    raise exception 'NOT_STAMPEE_STAFF_ACCOUNT';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(new_pin, extensions.gen_salt('bf', 10)),
      updated_at = now(),
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = ''
  where id = staff_id;

  -- Password reset must invalidate old refresh sessions. The catalog check keeps
  -- compatibility with older local Auth stubs; the current harness tests real session rows.
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using staff_id;
  end if;
end;
$$;

-- Repair only rows created by Stampee's staff provisioner and only when their
-- metadata still points at an active business owned by the provisioning owner.
update auth.users u
set confirmation_token = coalesce(u.confirmation_token, ''),
    recovery_token = coalesce(u.recovery_token, ''),
    email_change_token_new = coalesce(u.email_change_token_new, ''),
    email_change = coalesce(u.email_change, ''),
    updated_at = now()
where u.raw_app_meta_data->>'stampee_staff_provisioned' = 'true'
  and (u.confirmation_token is null or u.recovery_token is null
    or u.email_change_token_new is null or u.email_change is null)
  and exists (select 1 from public.profiles p where p.id = u.id and p.role = 'staff')
  and exists (
    select 1
    from public.businesses b
    join public.business_memberships m
      on m.business_id = b.id
     and m.user_id::text = lower(u.raw_app_meta_data->>'stampee_owner_user_id')
     and m.role = 'owner'
     and m.access = 'active'
    where b.id::text = lower(u.raw_app_meta_data->>'stampee_business_id')
      and b.owner_user_id::text = lower(u.raw_app_meta_data->>'stampee_owner_user_id')
      and b.access = 'active'
  );

revoke execute on function public.create_staff_account(text,text,text,uuid) from public, anon, authenticated;
revoke execute on function public.update_staff_pin(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.create_staff_account(text,text,text,uuid) to authenticated;
grant execute on function public.update_staff_pin(uuid,text,uuid) to authenticated;
