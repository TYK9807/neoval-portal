-- n8n automation: Supabase Database Webhooks via pg_net (free plan has no
-- webhook UI, so triggers call net.http_post() directly).
--
-- Payload shape matches Supabase's native Database Webhook envelope, because
-- the live n8n workflows ("Neoval — 1. Commandes", "Neoval — 2. Inscriptions")
-- were built against that exact shape:
--   { type: 'INSERT' | 'UPDATE', table: '<name>', record: {...new row...}, old_record: {...old row...} | null }
--
-- The n8n "Classifier" code nodes read type/record/old_record to decide the
-- action (new_order / confirmed / delivered, or new_registration / approved / rejected)
-- and an IF/Switch node discards anything irrelevant — so these triggers fire on
-- every INSERT/UPDATE unconditionally; no status filtering needed at the DB level.

-- ============================================================
-- orders -> https://tahayassine.app.n8n.cloud/webhook/neoval-orders
-- ============================================================
create or replace function public.notify_n8n_orders_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  -- Shared secret for the n8n webhook's Header Auth — the SAME Vault secret used
  -- by the registrations webhook, so both webhooks are secured consistently.
  -- Referenced by name only; never hardcoded in this file.
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'n8n_webhook_token'
  limit 1;

  perform net.http_post(
    url := 'https://tahayassine.app.n8n.cloud/webhook/neoval-orders',
    body := jsonb_build_object(
      'type', tg_op,
      'table', 'orders',
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Neoval-Webhook-Token', coalesce(v_token, '')
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists neoval_orders_insert on public.orders;
create trigger neoval_orders_insert
after insert on public.orders
for each row execute function public.notify_n8n_orders_event();

drop trigger if exists neoval_orders_update on public.orders;
create trigger neoval_orders_update
after update on public.orders
for each row execute function public.notify_n8n_orders_event();

-- ============================================================
-- pending_registrations -> https://tahayassine.app.n8n.cloud/webhook/neoval-registrations
-- ============================================================
create or replace function public.notify_n8n_registrations_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  -- The approval email (which embeds the single-use invite link) is dispatched
  -- directly by the approve-registration edge function, because only it holds the
  -- link — and the link must never travel through Postgres. So skip the 'approved'
  -- UPDATE transition here to avoid a duplicate, link-less approval email.
  if tg_op = 'UPDATE' and new.status = 'approved'
     and old.status is distinct from 'approved' then
    return new;
  end if;

  -- Shared secret for the n8n webhook's Header Auth. Stored ONLY in Supabase Vault
  -- (single source of truth) — referenced here by name, never hardcoded in this file.
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'n8n_webhook_token'
  limit 1;

  perform net.http_post(
    url := 'https://tahayassine.app.n8n.cloud/webhook/neoval-registrations',
    body := jsonb_build_object(
      'type', tg_op,
      'table', 'pending_registrations',
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Neoval-Webhook-Token', coalesce(v_token, '')
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

-- ============================================================
-- Vault accessor for the n8n webhook Header Auth token.
-- The approve-registration edge function calls this (with the service_role key)
-- to read the shared secret from Vault — so the value lives in exactly one place
-- on the Supabase side and never appears in source. Locked to service_role only.
-- ============================================================
create or replace function public.get_n8n_webhook_token()
returns text
language sql
security definer
set search_path = public
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'n8n_webhook_token'
  limit 1;
$$;

revoke all on function public.get_n8n_webhook_token() from public, anon, authenticated;
grant execute on function public.get_n8n_webhook_token() to service_role;

drop trigger if exists neoval_registrations_insert on public.pending_registrations;
create trigger neoval_registrations_insert
after insert on public.pending_registrations
for each row execute function public.notify_n8n_registrations_event();

drop trigger if exists neoval_registrations_update on public.pending_registrations;
create trigger neoval_registrations_update
after update on public.pending_registrations
for each row execute function public.notify_n8n_registrations_event();

-- ============================================================
-- RPC so n8n's "Chercher Pharmacie" HTTP node can look up the placing user's
-- name/email with the anon key. Direct REST reads of public.users are blocked
-- by RLS for anon (SELECT policies are authenticated-only), so this
-- SECURITY DEFINER function is the safe alternative to handing n8n the
-- service_role key.
-- ============================================================
create or replace function public.get_user_contact(p_user_id uuid)
returns table(name text, email text)
language sql
security definer
set search_path = public
as $$
  select name, email from public.users where id = p_user_id;
$$;

grant execute on function public.get_user_contact(uuid) to anon, authenticated;
