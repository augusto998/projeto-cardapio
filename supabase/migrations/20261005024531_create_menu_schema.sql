create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  telefone text,
  whatsapp text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid,
  name text not null,
  description text,
  detail text,
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  image_alt text,
  is_available boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_category_restaurant_fkey
    foreign key (category_id, restaurant_id)
    references public.categories (id, restaurant_id)
    on delete set null (category_id)
);

create table public.restaurant_admins (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create index categories_restaurant_id_idx
  on public.categories (restaurant_id);

create index products_restaurant_id_idx
  on public.products (restaurant_id);

create index products_category_id_idx
  on public.products (category_id);

create index restaurant_admins_restaurant_id_idx
  on public.restaurant_admins (restaurant_id);

create index restaurant_admins_user_id_idx
  on public.restaurant_admins (user_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger restaurant_admins_set_updated_at
before update on public.restaurant_admins
for each row execute function public.set_updated_at();

create function public.has_restaurant_role(
  target_restaurant_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.restaurant_admins as admins
    where admins.restaurant_id = target_restaurant_id
      and admins.user_id = (select auth.uid())
      and admins.role = any (allowed_roles)
  );
$$;

revoke all on function public.has_restaurant_role(uuid, text[]) from public, anon;
grant execute on function public.has_restaurant_role(uuid, text[]) to authenticated;

alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.restaurant_admins enable row level security;

grant select on public.restaurants, public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.restaurants, public.categories, public.products to authenticated;
grant select, insert, update, delete on public.restaurant_admins to authenticated;

create policy "Public can read restaurants"
on public.restaurants
for select
to anon, authenticated
using (is_public);

create policy "Restaurant admins can manage their restaurants"
on public.restaurants
for all
to authenticated
using (public.has_restaurant_role(id, array['owner', 'admin']::text[]))
with check (public.has_restaurant_role(id, array['owner', 'admin']::text[]));

create policy "Public can read categories"
on public.categories
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.restaurants as restaurants
    where restaurants.id = categories.restaurant_id
      and restaurants.is_public
  )
);

create policy "Restaurant admins can manage their categories"
on public.categories
for all
to authenticated
using (public.has_restaurant_role(restaurant_id, array['owner', 'admin']::text[]))
with check (public.has_restaurant_role(restaurant_id, array['owner', 'admin']::text[]));

create policy "Public can read available products"
on public.products
for select
to anon, authenticated
using (
  is_available
  and exists (
    select 1
    from public.restaurants as restaurants
    where restaurants.id = products.restaurant_id
      and restaurants.is_public
  )
);

create policy "Restaurant admins can manage their products"
on public.products
for all
to authenticated
using (public.has_restaurant_role(restaurant_id, array['owner', 'admin']::text[]))
with check (public.has_restaurant_role(restaurant_id, array['owner', 'admin']::text[]));

create policy "Restaurant admins can read associated administrators"
on public.restaurant_admins
for select
to authenticated
using (public.has_restaurant_role(restaurant_id, array['owner', 'admin']::text[]));

create policy "Owners and admins can add admin associations without self-escalation"
on public.restaurant_admins
for insert
to authenticated
with check (
  user_id <> (select auth.uid())
  and (
    (
      role = 'owner'
      and public.has_restaurant_role(restaurant_id, array['owner']::text[])
    )
    or
    (
      role = 'admin'
      and public.has_restaurant_role(restaurant_id, array['owner', 'admin']::text[])
    )
  )
);

create policy "Owners can update other administrator associations"
on public.restaurant_admins
for update
to authenticated
using (
  user_id <> (select auth.uid())
  and public.has_restaurant_role(restaurant_id, array['owner']::text[])
)
with check (
  user_id <> (select auth.uid())
  and public.has_restaurant_role(restaurant_id, array['owner']::text[])
);

create policy "Admins can update admin associations without changing role"
on public.restaurant_admins
for update
to authenticated
using (
  role = 'admin'
  and user_id <> (select auth.uid())
  and public.has_restaurant_role(restaurant_id, array['owner', 'admin']::text[])
)
with check (
  role = 'admin'
  and user_id <> (select auth.uid())
  and public.has_restaurant_role(restaurant_id, array['owner', 'admin']::text[])
);

create policy "Owners can remove other administrator associations"
on public.restaurant_admins
for delete
to authenticated
using (
  user_id <> (select auth.uid())
  and public.has_restaurant_role(restaurant_id, array['owner']::text[])
);

create policy "Admins can remove admin associations without self-escalation"
on public.restaurant_admins
for delete
to authenticated
using (
  role = 'admin'
  and user_id <> (select auth.uid())
  and public.has_restaurant_role(restaurant_id, array['owner', 'admin']::text[])
);
