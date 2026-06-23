-- ============================================================
-- Neoval Pharma — Notifications
-- Run AFTER policies.sql (requires current_user_role() function)
-- ============================================================

create table if not exists notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references users(id) on delete cascade,
  target_role text        check (target_role in ('pharmacy', 'admin')),
  type        text        not null,
  title       text        not null,
  body        text,
  link        text,
  read        boolean     default false,
  created_at  timestamptz default now()
  -- user_id = NULL + target_role means role-broadcast (all users of that role see it).
  -- shared read flag: marking read affects all users of that role.
);

alter table notifications enable row level security;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Personal (user_id = me) or role-broadcast (user_id IS NULL, target_role = my role)
create policy "Users read own notifications"
  on notifications for select to authenticated
  using (
    user_id = auth.uid()
    or (user_id is null and target_role = public.current_user_role())
  );

-- Mark read: same condition
create policy "Users mark own notifications read"
  on notifications for update to authenticated
  using (
    user_id = auth.uid()
    or (user_id is null and target_role = public.current_user_role())
  )
  with check (true);

-- Admins can insert (for announcements). Triggers use SECURITY DEFINER and bypass RLS.
create policy "Admins insert notifications"
  on notifications for insert to authenticated
  with check (public.current_user_role() = 'admin');

-- Enable Realtime (delivers INSERT events respecting the RLS policies above)
alter publication supabase_realtime add table notifications;

-- ============================================================
-- Trigger 1: New order → notify all admins
-- ============================================================

create or replace function notify_admin_new_order()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (user_id, target_role, type, title, body, link)
  values (
    null,
    'admin',
    'new_order',
    'Nouvelle commande',
    'Une nouvelle commande a été soumise.',
    '/admin/Admin Order détail.html?id=' || NEW.id::text
  );
  return NEW;
end;
$$;

drop trigger if exists on_order_inserted on public.orders;
create trigger on_order_inserted
  after insert on public.orders
  for each row execute function notify_admin_new_order();

-- ============================================================
-- Trigger 2: Order status change → notify the pharmacy user
-- ============================================================

create or replace function notify_pharmacy_order_status()
returns trigger language plpgsql security definer as $$
declare
  v_title text;
  v_body  text;
begin
  if OLD.status = NEW.status or NEW.placed_by is null then return NEW; end if;

  case NEW.status
    when 'Confirmé' then
      v_title := 'Commande confirmée';
      v_body  := 'Votre commande a été confirmée. Le bon de livraison est disponible.';
    when 'Livré' then
      v_title := 'Commande livrée';
      v_body  := 'Votre commande a été livrée avec succès.';
    else
      v_title := 'Statut de commande mis à jour';
      v_body  := 'Nouveau statut : ' || NEW.status;
  end case;

  insert into public.notifications (user_id, target_role, type, title, body, link)
  values (
    NEW.placed_by,
    null,
    'order_status',
    v_title,
    v_body,
    '/Commande détail.html?id=' || NEW.id::text
  );
  return NEW;
end;
$$;

drop trigger if exists on_order_status_changed on public.orders;
create trigger on_order_status_changed
  after update of status on public.orders
  for each row execute function notify_pharmacy_order_status();

-- ============================================================
-- Trigger 3: New registration request → notify all admins
-- ============================================================

create or replace function notify_admin_new_registration()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (user_id, target_role, type, title, body, link)
  values (
    null,
    'admin',
    'new_registration',
    'Nouvelle demande d''inscription',
    NEW.pharmacy_name || ' — ' || NEW.contact_name,
    '/admin/Admin Registration détail.html?id=' || NEW.id::text
  );
  return NEW;
end;
$$;

drop trigger if exists on_registration_submitted on public.pending_registrations;
create trigger on_registration_submitted
  after insert on public.pending_registrations
  for each row execute function notify_admin_new_registration();
