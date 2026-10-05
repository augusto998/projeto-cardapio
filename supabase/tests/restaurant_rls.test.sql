begin;

select plan(22);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'rls-owner@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'authenticated',
    'authenticated',
    'rls-admin@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'authenticated',
    'authenticated',
    'rls-outsider@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    'authenticated',
    'authenticated',
    'rls-other-admin@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.restaurants (id, name, slug, is_public)
values
  (
    '00000000-0000-0000-0000-000000000201',
    'Public Test Restaurant',
    'rls-public-test',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    'Private Test Restaurant',
    'rls-private-test',
    false
  );

insert into public.categories (id, restaurant_id, name)
values
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    'Public test category'
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000202',
    'Private test category'
  );

insert into public.products (
  id,
  restaurant_id,
  category_id,
  name,
  price,
  is_available
)
values
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000301',
    'Available public product',
    10.00,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000301',
    'Unavailable public product',
    11.00,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000302',
    'Private restaurant product',
    12.00,
    true
  );

insert into public.restaurant_admins (restaurant_id, user_id, role)
values
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    'owner'
  ),
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000102',
    'admin'
  ),
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000104',
    'admin'
  );

set local role anon;

select is(
  (select count(*) from public.restaurants where id = '00000000-0000-0000-0000-000000000201'),
  1::bigint,
  'visitor can read a public restaurant'
);

select is(
  (select count(*) from public.restaurants where id = '00000000-0000-0000-0000-000000000202'),
  0::bigint,
  'visitor cannot read a private restaurant'
);

select is(
  (select count(*) from public.products where id = '00000000-0000-0000-0000-000000000401'),
  1::bigint,
  'visitor can read an available product of a public restaurant'
);

select is(
  (select count(*) from public.products where id = '00000000-0000-0000-0000-000000000402'),
  0::bigint,
  'visitor cannot read an unavailable product'
);

select throws_ok(
  $$insert into public.restaurants (name, slug) values ('Anon restaurant', 'rls-anon-write')$$,
  '42501',
  null,
  'visitor cannot insert restaurants'
);

select throws_ok(
  $$update public.restaurants set name = 'Anon update' where id = '00000000-0000-0000-0000-000000000201'$$,
  '42501',
  null,
  'visitor cannot update restaurants'
);

select throws_ok(
  $$delete from public.products where id = '00000000-0000-0000-0000-000000000401'$$,
  '42501',
  null,
  'visitor cannot delete products'
);

reset role;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000102';
set local role authenticated;

update public.restaurants
set name = 'Admin A must not change restaurant B'
where id = '00000000-0000-0000-0000-000000000202';

reset role;

select is(
  (select name from public.restaurants where id = '00000000-0000-0000-0000-000000000202'),
  'Private Test Restaurant',
  'admin of restaurant A cannot update restaurant B'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000102';
set local role authenticated;

insert into public.products (
  id,
  restaurant_id,
  category_id,
  name,
  price
)
values (
  '00000000-0000-0000-0000-000000000404',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000301',
  'Admin managed product',
  13.00
);

select is(
  (select count(*) from public.products where id = '00000000-0000-0000-0000-000000000404'),
  1::bigint,
  'admin can insert a product in their restaurant'
);

update public.products
set name = 'Updated admin product'
where id = '00000000-0000-0000-0000-000000000404';

select is(
  (select name from public.products where id = '00000000-0000-0000-0000-000000000404'),
  'Updated admin product',
  'admin can update a product in their restaurant'
);

delete from public.products
where id = '00000000-0000-0000-0000-000000000404';

select is(
  (select count(*) from public.products where id = '00000000-0000-0000-0000-000000000404'),
  0::bigint,
  'admin can delete a product in their restaurant'
);

update public.restaurant_admins
set role = 'owner'
where restaurant_id = '00000000-0000-0000-0000-000000000201'
  and user_id = (select auth.uid());

select is(
  (select role from public.restaurant_admins where user_id = (select auth.uid())),
  'admin',
  'admin cannot promote their own association'
);

select throws_ok(
  $$update public.restaurant_admins
    set role = 'owner'
    where restaurant_id = '00000000-0000-0000-0000-000000000201'
      and user_id = '00000000-0000-0000-0000-000000000104'$$,
  '42501',
  null,
  'admin cannot promote another administrator to owner'
);

delete from public.restaurant_admins
where restaurant_id = '00000000-0000-0000-0000-000000000201'
  and user_id = '00000000-0000-0000-0000-000000000101';

select is(
  (select count(*) from public.restaurant_admins where user_id = '00000000-0000-0000-0000-000000000101'),
  1::bigint,
  'admin cannot remove an owner'
);

reset role;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
set local role authenticated;

insert into public.restaurant_admins (restaurant_id, user_id, role)
values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000103',
  'admin'
);

select is(
  (select count(*) from public.restaurant_admins where user_id = '00000000-0000-0000-0000-000000000103'),
  1::bigint,
  'owner can add an administrator to their restaurant'
);

update public.restaurant_admins
set role = 'owner'
where restaurant_id = '00000000-0000-0000-0000-000000000201'
  and user_id = '00000000-0000-0000-0000-000000000103';

select is(
  (select role from public.restaurant_admins where user_id = '00000000-0000-0000-0000-000000000103'),
  'owner',
  'owner can change another association role'
);

delete from public.restaurant_admins
where restaurant_id = '00000000-0000-0000-0000-000000000201'
  and user_id = '00000000-0000-0000-0000-000000000103';

select is(
  (select count(*) from public.restaurant_admins where user_id = '00000000-0000-0000-0000-000000000103'),
  0::bigint,
  'owner can remove an administrator association'
);

delete from public.restaurant_admins
where restaurant_id = '00000000-0000-0000-0000-000000000201'
  and user_id = (select auth.uid());

select is(
  (select role from public.restaurant_admins where user_id = (select auth.uid())),
  'owner',
  'owner cannot remove their own association'
);

reset role;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000103';
set local role authenticated;

update public.restaurants
set name = 'Unassociated user update'
where id = '00000000-0000-0000-0000-000000000201';

reset role;

select is(
  (select name from public.restaurants where id = '00000000-0000-0000-0000-000000000201'),
  'Public Test Restaurant',
  'unassociated user cannot update a restaurant'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000103';
set local role authenticated;

select throws_ok(
  $$insert into public.products (restaurant_id, name, price)
    values ('00000000-0000-0000-0000-000000000201', 'Unauthorized product', 1.00)$$,
  '42501',
  null,
  'unassociated user cannot insert products'
);

delete from public.products
where id = '00000000-0000-0000-0000-000000000401';

delete from public.restaurant_admins
where restaurant_id = '00000000-0000-0000-0000-000000000201';

reset role;

select is(
  (select count(*) from public.products where id = '00000000-0000-0000-0000-000000000401'),
  1::bigint,
  'unassociated user cannot delete a product'
);

select is(
  (select count(*) from public.restaurant_admins where restaurant_id = '00000000-0000-0000-0000-000000000201'),
  3::bigint,
  'unassociated user cannot delete administrator associations'
);

select * from finish();

rollback;
