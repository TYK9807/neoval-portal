-- ============================================================
-- Neoval Pharma — Products Seed Data
-- Paste into: Supabase Dashboard → SQL Editor → New query
-- Run AFTER schema.sql
-- ============================================================

insert into products (name, category, description, price, stock_quantity) values
  (
    'ARCAR 300',
    'Compléments alimentaires',
    'Mobilité et équilibre — 30 gélules. Formule à base de glucosamine et chondroïtine pour soutenir la mobilité articulaire et l''équilibre.',
    95.00,
    150
  ),
  (
    'Liberel',
    'Cosmétiques',
    'Gel de massage 100ml. Gel relaxant à base de plantes pour soulager les tensions musculaires et articulaires.',
    88.00,
    120
  ),
  (
    'FERCAP',
    'Compléments alimentaires',
    'Fer micronisé + Vitamine C — 30 gélules. Fer hautement assimilable associé à la vitamine C pour une absorption optimale.',
    110.00,
    180
  ),
  (
    'MACAL',
    'Compléments alimentaires',
    'Magnésium + Calcium Dual Action — 40 gélules. Synergie magnésium-calcium pour la santé osseuse et musculaire.',
    120.00,
    160
  ),
  (
    'Soulnat',
    'Compléments alimentaires',
    'Confort articulaire — 30 gélules. Complexe naturel pour le maintien du confort articulaire au quotidien.',
    135.00,
    100
  ),
  (
    'D-LIQ 400 UI',
    'Compléments alimentaires',
    'Vitamine D3 liquide — 50ml. Vitamine D3 naturelle en solution huileuse, 400 UI par dose, pour l''immunité et la santé osseuse.',
    98.00,
    140
  ),
  (
    'NERCURE',
    'Compléments alimentaires',
    'Acetyl L-Carnitine + CoQ10 — 30 comprimés. Association synergique pour l''énergie cellulaire, la fonction cognitive et le métabolisme.',
    145.00,
    80
  );
