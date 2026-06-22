-- ============================================================
-- Neoval Pharma — Pharmacy Registration Requests
-- Paste into: Supabase Dashboard → SQL Editor → New query
-- Run AFTER policies.sql (requires current_user_role() function)
-- ============================================================

create table if not exists pending_registrations (
  id            uuid primary key default gen_random_uuid(),
  pharmacy_name text not null,
  contact_name  text not null,
  email         text not null,
  phone         text,
  address       text,
  ice_number    text,
  status        text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  submitted_at  timestamptz default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references users(id)
);

alter table pending_registrations enable row level security;

-- Anyone (anon or logged-in user) can submit a registration request
create policy "Anyone can submit a registration"
  on pending_registrations for insert
  to anon, authenticated
  with check (true);

-- Only admins can read registrations
create policy "Admins can read all registrations"
  on pending_registrations for select
  to authenticated
  using (public.current_user_role() = 'admin');

-- Only admins can update (approve/reject) registrations
create policy "Admins can update registrations"
  on pending_registrations for update
  to authenticated
  using (public.current_user_role() = 'admin');
