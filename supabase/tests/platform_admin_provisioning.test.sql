begin;
select plan(10);

select ok(
  (select relrowsecurity from pg_class where oid = 'private.platform_admins'::regclass),
  'platform admin table has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'private.restaurant_provisioning_attempts'::regclass),
  'provisioning attempts table has RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'private.platform_admins', 'SELECT')
  and not has_table_privilege('authenticated', 'private.platform_admins', 'SELECT'),
  'frontend roles cannot read platform admins'
);

select ok(
  not has_table_privilege('anon', 'private.platform_admins', 'INSERT')
  and not has_table_privilege('authenticated', 'private.platform_admins', 'INSERT'),
  'frontend roles cannot write platform admins'
);

select ok(
  not has_function_privilege('anon', 'private.is_platform_admin(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.is_platform_admin(uuid)', 'EXECUTE'),
  'frontend roles cannot call private authorization helper'
);

select ok(
  not has_function_privilege('anon', 'public.is_platform_admin(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.is_platform_admin(uuid)', 'EXECUTE'),
  'frontend roles cannot call platform authorization RPC'
);

select ok(
  has_function_privilege('service_role', 'public.is_platform_admin(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.finalize_restaurant_provision(uuid,text,text,text,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.get_restaurant_provision_status(uuid)', 'EXECUTE'),
  'service role can call required server RPCs'
);

select ok(
  has_function_privilege('service_role', 'public.begin_restaurant_provision(uuid,uuid,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.record_restaurant_provision_auth_user(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.set_restaurant_provision_status(uuid,text,uuid)', 'EXECUTE'),
  'service role can manage provisioning attempt states'
);

select ok(
  not has_function_privilege('anon', 'public.finalize_restaurant_provision(uuid,text,text,text,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.finalize_restaurant_provision(uuid,text,text,text,text,text)', 'EXECUTE'),
  'frontend roles cannot provision restaurants'
);

select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'private.is_platform_admin(uuid)'::regprocedure),
  'private authorization helper is definer-secured with an empty search path'
);

select * from finish();
rollback;
