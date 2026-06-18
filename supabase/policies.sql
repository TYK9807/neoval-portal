-- ============================================================
-- Neoval Pharma — Row Level Security policies (definitive)
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run: drops existing policies before recreating.
-- ============================================================

-- helper function (idempotent)
create or replace function public.current_user_role()
returns text language sql security definer as $$
  select role from public.users where id = auth.uid()
$$;

-- ---- USERS ----

drop policy if exists "Users can read own profile"  on users;
drop policy if exists "Admins can read all users"    on users;
drop policy if exists "Users can update own profile" on users;

create policy "Users can read own profile"
  on users for select to authenticated
  using (auth.uid() = id);

create policy "Admins can read all users"
  on users for select to authenticated
  using (public.current_user_role() = 'admin');

create policy "Users can update own profile"
  on users for update to authenticated
  using (auth.uid() = id);

-- ---- ORDERS ----

drop policy if exists "Pharmacy users can place orders"   on orders;
drop policy if exists "Pharmacy users can read own orders" on orders;
drop policy if exists "Admins can read all orders"         on orders;
drop policy if exists "Admins can update orders"           on orders;

create policy "Pharmacy users can place orders"
  on orders for insert to authenticated
  with check (
    auth.uid() = placed_by
    and public.current_user_role() = 'pharmacy'
  );

create policy "Pharmacy users can read own orders"
  on orders for select to authenticated
  using (placed_by = auth.uid());

create policy "Admins can read all orders"
  on orders for select to authenticated
  using (public.current_user_role() = 'admin');

create policy "Admins can update orders"
  on orders for update to authenticated
  using (public.current_user_role() = 'admin');

-- ---- ORDER ITEMS ----

drop policy if exists "Pharmacy users can insert order items" on order_items;
drop policy if exists "Pharmacy users can read own order items" on order_items;
drop policy if exists "Admins can read all order items"         on order_items;
drop policy if exists "Admins can update order items"           on order_items;

create policy "Pharmacy users can insert order items"
  on order_items for insert to authenticated
  with check (
    exists (select 1 from orders o where o.id = order_id and o.placed_by = auth.uid())
  );

create policy "Pharmacy users can read own order items"
  on order_items for select to authenticated
  using (
    exists (select 1 from orders o where o.id = order_id and o.placed_by = auth.uid())
  );

create policy "Admins can read all order items"
  on order_items for select to authenticated
  using (public.current_user_role() = 'admin');

create policy "Admins can update order items"
  on order_items for update to authenticated
  using (public.current_user_role() = 'admin');

-- ---- PHARMACIES ----

drop policy if exists "Authenticated users can read pharmacies" on pharmacies;

create policy "Authenticated users can read pharmacies"
  on pharmacies for select to authenticated
  using (true);