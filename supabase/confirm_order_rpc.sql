-- ============================================================
-- Neoval Pharma — confirm_order RPC with stock deduction
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (idempotent).
-- ============================================================

-- Remove the trigger-based approach to prevent double-deduction.
-- The RPC now owns the entire confirm flow.
drop trigger if exists trg_decrement_stock on orders;
drop function if exists public.decrement_stock_on_confirm();

-- confirm_order
-- Validates stock availability, deducts stock, and confirms the order.
-- Returns: { "ok": true }
--          { "ok": false, "insufficient": ["Product A", "Product B"] }
create or replace function public.confirm_order(
  p_order_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_insufficient text[];
begin
  -- Guard: order must exist and still be pending
  if not exists (
    select 1 from orders where id = p_order_id and status = 'En attente'
  ) then
    return jsonb_build_object('ok', false, 'insufficient', array[]::text[]);
  end if;

  -- Collect any product whose available stock is less than the ordered quantity
  select array_agg(p.name order by p.name)
  into   v_insufficient
  from   order_items oi
  join   products    p on p.id = oi.product_id
  where  oi.order_id      = p_order_id
    and  p.stock_quantity < oi.quantity;

  if v_insufficient is not null then
    return jsonb_build_object('ok', false, 'insufficient', v_insufficient);
  end if;

  -- Deduct stock for every item in the order
  update products p
  set    stock_quantity = p.stock_quantity - oi.quantity
  from   order_items oi
  where  oi.order_id   = p_order_id
    and  oi.product_id = p.id;

  -- Confirm the order
  update orders
  set    status       = 'Confirmé',
         confirmed_by = p_admin_id,
         confirmed_at = now()
  where  id = p_order_id;

  return jsonb_build_object('ok', true);
end;
$$;
