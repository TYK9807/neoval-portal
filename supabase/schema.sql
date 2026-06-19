-- ============================================================
-- Neoval Pharma B2B — Database Schema
-- Paste into: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Users (all roles)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  role text check (role in ('pharmacy', 'admin', 'sales_rep', 'delivery')),
  phone text,
  pharmacy_id uuid,
  created_at timestamptz default now()
);

-- Pharmacies
create table if not exists pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  ice_number text,
  sales_rep_id uuid,
  created_at timestamptz default now()
);

-- Products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  price numeric not null,
  stock_quantity integer default 0,
  image_url text,
  created_at timestamptz default now()
);

-- Orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid references pharmacies(id),
  placed_by uuid references users(id),
  status text check (status in ('En attente', 'Confirmé', 'Livré')) default 'En attente',
  total numeric,
  confirmed_by uuid references users(id),
  confirmed_at timestamptz,
  delivered_by uuid references users(id),
  delivered_at timestamptz,
  created_at timestamptz default now()
);

-- Order Items
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  product_id uuid references products(id),
  quantity integer not null,
  unit_price numeric not null
);

-- Documents
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  type text check (type in ('BL', 'POP')),
  file_url text,
  generated_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS) — enable after verifying tables
-- ============================================================

alter table users enable row level security;
alter table pharmacies enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table documents enable row level security;

-- Allow authenticated users to read products
create policy "Products are readable by authenticated users"
  on products for select
  to authenticated
  using (true);

-- Allow users to read their own profile
create policy "Users can read own profile"
  on users for select
  to authenticated
  using (auth.uid() = id);

-- Allow admin to read all users
create policy "Admins can read all users"
  on users for select
  to authenticated
  using (
    exists (
      select 1 from users u where u.id = auth.uid() and u.role = 'admin'
    )
  );
