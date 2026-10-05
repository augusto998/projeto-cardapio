create schema if not exists private;

revoke all on schema private from public, anon, authenticated, service_role;

create table private.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  revoked_at timestamptz
);

create table private.restaurant_provisioning_attempts (
  id uuid primary key,
  platform_admin_user_id uuid not null references auth.users (id),
  email text not null,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  status text not null check (
    status in (
      'started',
      'auth_creation_unknown',
      'auth_created',
      'completed',
      'compensation_required',
      'compensated',
      'database_commit_unknown',
      'notification_pending',
      'notified'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.platform_admins enable row level security;
alter table private.restaurant_provisioning_attempts enable row level security;

revoke all on table private.platform_admins from public, anon, authenticated, service_role;
revoke all on table private.restaurant_provisioning_attempts from public, anon, authenticated, service_role;

create function private.is_platform_admin(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from private.platform_admins as admins
    where admins.user_id = target_user_id
      and admins.revoked_at is null
  );
$$;

revoke all on function private.is_platform_admin(uuid) from public, anon, authenticated, service_role;

create function public.is_platform_admin(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select private.is_platform_admin(target_user_id);
$$;

revoke all on function public.is_platform_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_platform_admin(uuid) to service_role;

create function public.begin_restaurant_provision(
  target_attempt_id uuid,
  target_platform_admin_user_id uuid,
  target_email text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not private.is_platform_admin(target_platform_admin_user_id) then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  insert into private.restaurant_provisioning_attempts (
    id,
    platform_admin_user_id,
    email,
    status
  )
  values (
    target_attempt_id,
    target_platform_admin_user_id,
    target_email,
    'started'
  );
end;
$$;

revoke all on function public.begin_restaurant_provision(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.begin_restaurant_provision(uuid, uuid, text) to service_role;

create function public.record_restaurant_provision_auth_user(
  target_attempt_id uuid,
  target_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  attempt_admin_user_id uuid;
begin
  select attempts.platform_admin_user_id
  into attempt_admin_user_id
  from private.restaurant_provisioning_attempts as attempts
  where attempts.id = target_attempt_id
    and attempts.status = 'started'
  for update;

  if attempt_admin_user_id is null
     or not private.is_platform_admin(attempt_admin_user_id)
     or not exists (
       select 1
       from auth.users as users
       join private.restaurant_provisioning_attempts as attempts
         on attempts.id = target_attempt_id
       where users.id = target_auth_user_id
         and lower(users.email) = attempts.email
     ) then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  update private.restaurant_provisioning_attempts
  set auth_user_id = target_auth_user_id,
      status = 'auth_created',
      updated_at = now()
  where id = target_attempt_id;
end;
$$;

revoke all on function public.record_restaurant_provision_auth_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_restaurant_provision_auth_user(uuid, uuid) to service_role;

create function public.finalize_restaurant_provision(
  target_attempt_id uuid,
  target_name text,
  target_slug text,
  target_telefone text,
  target_whatsapp text,
  target_logo_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  provision_attempt private.restaurant_provisioning_attempts%rowtype;
  new_restaurant_id uuid;
begin
  select attempts.*
  into provision_attempt
  from private.restaurant_provisioning_attempts as attempts
  where attempts.id = target_attempt_id
    and attempts.status = 'auth_created'
  for update;

  if not found
     or not private.is_platform_admin(provision_attempt.platform_admin_user_id) then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  if nullif(btrim(target_name), '') is null
     or target_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or length(target_slug) > 63 then
    raise exception using errcode = '22023', message = 'Invalid restaurant data';
  end if;

  perform 1
  from auth.users as users
  where users.id = provision_attempt.auth_user_id
  for update;

  if not found or exists (
    select 1
    from public.restaurant_admins as admins
    where admins.user_id = provision_attempt.auth_user_id
  ) then
    raise exception using errcode = '23514', message = 'Owner already associated';
  end if;

  insert into public.restaurants (
    name,
    slug,
    telefone,
    whatsapp,
    logo_url,
    is_public
  )
  values (
    btrim(target_name),
    target_slug,
    nullif(btrim(target_telefone), ''),
    nullif(btrim(target_whatsapp), ''),
    nullif(btrim(target_logo_url), ''),
    false
  )
  returning id into new_restaurant_id;

  insert into public.restaurant_admins (restaurant_id, user_id, role)
  values (new_restaurant_id, provision_attempt.auth_user_id, 'owner');

  update private.restaurant_provisioning_attempts
  set status = 'completed',
      restaurant_id = new_restaurant_id,
      updated_at = now()
  where id = target_attempt_id;

  return new_restaurant_id;
end;
$$;

revoke all on function public.finalize_restaurant_provision(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.finalize_restaurant_provision(uuid, text, text, text, text, text) to service_role;

create function public.get_restaurant_provision_status(target_attempt_id uuid)
returns table (status text, auth_user_id uuid, restaurant_id uuid)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select attempts.status, attempts.auth_user_id, attempts.restaurant_id
  from private.restaurant_provisioning_attempts as attempts
  where attempts.id = target_attempt_id;
$$;

revoke all on function public.get_restaurant_provision_status(uuid) from public, anon, authenticated;
grant execute on function public.get_restaurant_provision_status(uuid) to service_role;

create function public.set_restaurant_provision_status(
  target_attempt_id uuid,
  target_status text,
  target_auth_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_status text;
begin
  if target_status not in (
    'auth_creation_unknown',
    'compensation_required',
    'compensated',
    'database_commit_unknown',
    'notification_pending',
    'notified'
  ) then
    raise exception using errcode = '22023', message = 'Invalid attempt status';
  end if;

  select attempts.status
  into current_status
  from private.restaurant_provisioning_attempts as attempts
  where attempts.id = target_attempt_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Provisioning attempt not found';
  end if;

  if (target_status = 'auth_creation_unknown' and current_status <> 'started')
     or (target_status in ('compensation_required', 'compensated') and current_status not in ('started', 'auth_created'))
     or (target_status = 'database_commit_unknown' and current_status <> 'auth_created')
     or (target_status = 'notification_pending' and current_status <> 'completed')
     or (target_status = 'notified' and current_status not in ('completed', 'notification_pending')) then
    raise exception using errcode = '22023', message = 'Invalid attempt state transition';
  end if;

  update private.restaurant_provisioning_attempts
  set status = target_status,
      auth_user_id = coalesce(target_auth_user_id, auth_user_id),
      email = case when target_status in ('compensated', 'notified') then '' else email end,
      updated_at = now()
  where id = target_attempt_id;
end;
$$;

revoke all on function public.set_restaurant_provision_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.set_restaurant_provision_status(uuid, text, uuid) to service_role;
