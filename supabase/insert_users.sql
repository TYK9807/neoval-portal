-- ============================================================
-- Neoval Pharma — Insert test users into public.users
-- UUIDs must match the ones in Supabase Auth (auth.users)
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

insert into users (id, email, name, role, pharmacy_id)
values
  (
    'd590ed75-fa1c-4ee6-ba14-cfed97442921',
    'admin@neovalpharma.ma',
    'Admin Neoval',
    'admin',
    null
  ),
  (
    '779e3c39-27e0-442a-b6f8-3acd65df1ca5',
    'pharmacie@test.ma',
    'Dr. Reda Amrani',
    'pharmacy',
    null
  )
on conflict (id) do update
  set email = excluded.email,
      role  = excluded.role;
  -- name is intentionally excluded so manual profile updates are not overwritten
