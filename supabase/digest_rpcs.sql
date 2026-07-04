-- RPCs for the n8n digest workflows ("Neoval — 3. Digest quotidien" and
-- "Neoval — 4. Digest hebdomadaire"). Both workflows call Supabase REST
-- directly with the anon key; RLS on orders/products/users has no SELECT
-- policy for anon (SELECT is authenticated-only everywhere), so every read
-- was silently returning an empty array. Same root cause and same fix as
-- get_user_contact() in n8n_triggers.sql: SECURITY DEFINER functions that
-- bypass RLS, granted to anon.
--
-- Each RPC mirrors the exact shape of the REST query it replaces, so the
-- existing n8n Code nodes downstream needed no changes — only the HTTP
-- Request nodes' method/url/body were updated to call these instead.

-- ============================================================
-- Daily digest: pending ("En attente") orders + placing pharmacy contact.
-- Mirrors: /rest/v1/orders?status=eq.En attente&select=id,created_at,total,users!placed_by(name,email)&order=created_at.asc
-- ============================================================
create or replace function public.get_pending_orders_with_pharmacy()
returns table(id uuid, created_at timestamptz, total numeric, users jsonb)
language sql
security definer
set search_path = public
as $$
  select o.id, o.created_at, o.total,
         jsonb_build_object('name', u.name, 'email', u.email) as users
  from public.orders o
  left join public.users u on u.id = o.placed_by
  where o.status = 'En attente'
  order by o.created_at asc;
$$;

grant execute on function public.get_pending_orders_with_pharmacy() to anon, authenticated;

-- ============================================================
-- Daily digest: low stock products.
-- Mirrors: /rest/v1/products?stock_quantity=lt.50&select=name,stock_quantity&order=stock_quantity.asc
-- ============================================================
create or replace function public.get_low_stock_products()
returns table(name text, stock_quantity integer)
language sql
security definer
set search_path = public
as $$
  select p.name, p.stock_quantity
  from public.products p
  where p.stock_quantity < 50
  order by p.stock_quantity asc;
$$;

grant execute on function public.get_low_stock_products() to anon, authenticated;

-- ============================================================
-- Weekly digest: delivered ("Livré") orders + placing pharmacy name.
-- Mirrors: /rest/v1/orders?status=eq.Livré&select=id,total,created_at,users!placed_by(name)&order=created_at.desc
-- ============================================================
create or replace function public.get_delivered_orders_with_pharmacy()
returns table(id uuid, total numeric, created_at timestamptz, users jsonb)
language sql
security definer
set search_path = public
as $$
  select o.id, o.total, o.created_at,
         jsonb_build_object('name', u.name) as users
  from public.orders o
  left join public.users u on u.id = o.placed_by
  where o.status = 'Livré'
  order by o.created_at desc;
$$;

grant execute on function public.get_delivered_orders_with_pharmacy() to anon, authenticated;

-- ============================================================
-- Weekly digest: all order placements (used to derive 30-day activity).
-- Mirrors: /rest/v1/orders?select=placed_by,created_at
-- ============================================================
create or replace function public.get_order_placements()
returns table(placed_by uuid, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select o.placed_by, o.created_at
  from public.orders o;
$$;

grant execute on function public.get_order_placements() to anon, authenticated;

-- ============================================================
-- Weekly digest: registered pharmacy users, for re-engagement emails.
-- Mirrors: /rest/v1/users?role=eq.pharmacy&select=id,name,email
-- ============================================================
create or replace function public.get_pharmacy_users()
returns table(id uuid, name text, email text)
language sql
security definer
set search_path = public
as $$
  select u.id, u.name, u.email
  from public.users u
  where u.role = 'pharmacy';
$$;

grant execute on function public.get_pharmacy_users() to anon, authenticated;
