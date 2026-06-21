-- ============================================================
-- Neoval Pharma — Production fixes
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- ── Audit fields on orders ────────────────────────────────
alter table orders add column if not exists confirmed_at timestamptz;

-- ── documents RLS policies ───────────────────────────────
-- The documents table had RLS enabled in schema.sql but no
-- policies, making it completely inaccessible to everyone.
drop policy if exists "Pharmacy users can read own documents" on documents;
drop policy if exists "Admins can read all documents"         on documents;
drop policy if exists "Admins can insert documents"           on documents;

create policy "Pharmacy users can read own documents" on documents
  for select to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and o.placed_by = auth.uid()
    )
  );

create policy "Admins can read all documents" on documents
  for select to authenticated
  using (public.current_user_role() = 'admin');

create policy "Admins can insert documents" on documents
  for insert to authenticated
  with check (public.current_user_role() = 'admin');

-- ── Stock decrement trigger ───────────────────────────────
-- When an order transitions TO 'Confirmé', deduct each
-- ordered quantity from the matching product's stock.
-- greatest(0, …) prevents stock from going negative.
create or replace function public.decrement_stock_on_confirm()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'Confirmé' and old.status <> 'Confirmé' then
    update products p
    set    stock_quantity = greatest(0, p.stock_quantity - oi.quantity)
    from   order_items oi
    where  oi.order_id  = new.id
      and  oi.product_id = p.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_decrement_stock on orders;
create trigger trg_decrement_stock
  after update of status on orders
  for each row execute function public.decrement_stock_on_confirm();

-- ── documents: pharmacy insert + unique constraint ────────
-- Pharmacy users generate PDFs client-side and upload them;
-- they need INSERT on the documents table to record the path.
drop policy if exists "Pharmacy users can insert own documents" on documents;
create policy "Pharmacy users can insert own documents"
  on documents for insert to authenticated
  with check (
    exists (
      select 1 from orders o
      where o.id = order_id and o.placed_by = auth.uid()
    )
  );

-- Prevents duplicate BL/POP rows per order (needed for upsert).
alter table documents
  drop constraint if exists documents_order_type_unique;
alter table documents
  add constraint documents_order_type_unique unique (order_id, type);
