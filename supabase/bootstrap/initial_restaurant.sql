-- Run once from a trusted Supabase SQL Editor/database connection as postgres.
-- Fill in the three values below before execution.
-- This file is not a migration or an application RPC.

begin;

do $bootstrap$
declare
  bootstrap_owner_user_id constant uuid := null;
  bootstrap_restaurant_name constant text := null;
  bootstrap_restaurant_slug constant text := null;
  new_restaurant_id uuid;
begin
  if current_user <> 'postgres' then
    raise exception using
      errcode = '42501',
      message = 'Bootstrap requires a postgres database session';
  end if;

  if bootstrap_owner_user_id is null
     or nullif(btrim(bootstrap_restaurant_name), '') is null
     or nullif(btrim(bootstrap_restaurant_slug), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Set an existing Auth user UUID, restaurant name, and slug before running bootstrap';
  end if;

  lock table public.restaurants, public.restaurant_admins
    in share row exclusive mode;

  if exists (select 1 from public.restaurants)
     or exists (select 1 from public.restaurant_admins) then
    raise exception using
      errcode = '55000',
      message = 'Bootstrap is restricted to an empty restaurant/admin schema';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = bootstrap_owner_user_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'The specified owner UUID does not exist in Supabase Auth';
  end if;

  insert into public.restaurants (name, slug)
  values (btrim(bootstrap_restaurant_name), btrim(bootstrap_restaurant_slug))
  returning id into new_restaurant_id;

  insert into public.restaurant_admins (restaurant_id, user_id, role)
  values (new_restaurant_id, bootstrap_owner_user_id, 'owner');
end;
$bootstrap$;

commit;
