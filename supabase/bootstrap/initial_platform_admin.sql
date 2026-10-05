-- Replace this placeholder with the UUID of an existing Supabase Auth user.
-- Run once through a trusted postgres session; this is not an application RPC.
do $bootstrap$
declare
  first_platform_admin_id uuid := null;
begin
  if current_user <> 'postgres' then
    raise exception 'Bootstrap must be run by postgres';
  end if;

  if first_platform_admin_id is null then
    raise exception 'Set first_platform_admin_id to an existing auth.users ID';
  end if;

  lock table private.platform_admins in exclusive mode;

  if exists (select 1 from private.platform_admins) then
    raise exception 'Platform admin bootstrap is only allowed on an empty table';
  end if;

  if not exists (select 1 from auth.users where id = first_platform_admin_id) then
    raise exception 'The specified Auth user does not exist';
  end if;

  insert into private.platform_admins (user_id, created_by)
  values (first_platform_admin_id, first_platform_admin_id);
end;
$bootstrap$;
