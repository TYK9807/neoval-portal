-- ============================================================
-- Neoval Pharma — Row Level Security policies
-- Paste into: Supabase Dashboard → SQL Editor → New query
-- Run AFTER schema.sql
-- ============================================================

-- ---- ORDERS ----

create policy "Pharmacy users can place orders"
  on orders for insert
  to authenticated
  with check (
    auth.uid() = placed_by
    and exists (select 1 from users u where u.id = auth.uid() and u.role = 'pharmacy')
  );

create policy "Pharmacy users can read own orders"
  on orders for select
  to authenticated
  using (placed_by = auth.uid());

create policy "Admins can read all orders"
  on orders for select
  to authenticated
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin'));

create policy "Admins can update orders"
  on orders for update
  to authenticated
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin'));

-- ---- ORDER ITEMS ----

create policy "Pharmacy users can insert order items"
  on order_items for insert
  to authenticated
  with check (
    exists (select 1 from orders o where o.id = order_id and o.placed_by = auth.uid())
  );

create policy "Pharmacy users can read own order items"
  on order_items for select
  to authenticated
  using (
    exists (select 1 from orders o where o.id = order_id and o.placed_by = auth.uid())
  );

create policy "Admins can read all order items"
  on order_items for select
  to authenticated
  using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin'));

-- ---- PHARMACIES ----

create policy "Authenticated users can read pharmacies"
  on pharmacies for select
  to authenticated
  using (true);
