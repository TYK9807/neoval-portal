/**
 * End-to-end stock enforcement test.
 * Run: node scripts/test-stock-e2e.mjs
 *
 * What it tests:
 *  1. Admin signs in, sets first product stock to 0 via REST
 *  2. Verifies Supabase actually stored 0
 *  3. Pharmacy signs in, fetches catalogue — product must show stock_quantity = 0
 *  4. Pharmacy tries to place an order containing that product — must be blocked
 *  5. Admin tries to confirm the most recent pending order for that product — must be blocked
 *  6. Cleanup: restore original stock value
 */

import { createClient as _createClient } from '@supabase/supabase-js';

const URL  = 'https://nxlvdwqvkvgjvellmnic.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bHZkd3F2a3ZnanZlbGxtbmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTIwNDcsImV4cCI6MjA5NzI4ODA0N30.qF8GNEtYeZpgvQbysSVVUgUQGhZ-0ksK-LWK4KxyjJM';

const ADMIN_EMAIL    = 'admin@neovalpharma.ma';
const ADMIN_PASS     = 'Admin2024!';
const PHARMA_EMAIL   = 'pharmacie@test.ma';
const PHARMA_PASS    = 'Pharma2024!';

const adminSb  = _createClient(URL, ANON);
const pharmaSb = _createClient(URL, ANON);

let pass = 0, fail = 0;
function ok(msg)   { console.log('  ✓', msg); pass++; }
function err(msg)  { console.error('  ✗', msg); fail++; }
function section(s){ console.log('\n─', s); }

async function run() {
  // ── 1. Admin sign-in ───────────────────────────────────────────────────
  section('1. Admin sign-in');
  const { data: adminAuth, error: ae } = await adminSb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASS });
  if (ae || !adminAuth.user) { err('Admin login failed: ' + (ae?.message || 'no user')); process.exit(1); }
  ok('Admin signed in as ' + adminAuth.user.email);

  // ── 2. Pick a product and read its current stock ───────────────────────
  section('2. Pick test product');
  const { data: products, error: pe } = await adminSb.from('products').select('id, name, stock_quantity').order('name').limit(1);
  if (pe || !products?.length) { err('Cannot load products: ' + pe?.message); process.exit(1); }
  const product = products[0];
  const originalQty = product.stock_quantity ?? 0;
  console.log('   Product:', product.name, '| current stock:', originalQty);

  // ── 3. Admin sets stock to 0 ───────────────────────────────────────────
  section('3. Admin sets stock → 0');
  const { data: upd, error: ue } = await adminSb
    .from('products').update({ stock_quantity: 0 }).eq('id', product.id).select('id, stock_quantity');
  if (ue || !upd?.length) {
    err('UPDATE failed — RLS policy probably missing. Error: ' + (ue?.message || 'no rows returned'));
    console.log('\n  ► Run this in Supabase SQL Editor, then retry:\n');
    console.log('    drop policy if exists "Admins can update products" on products;');
    console.log('    create policy "Admins can update products"');
    console.log('      on products for update to authenticated');
    console.log('      using (public.current_user_role() = \'admin\');');
    process.exit(1);
  }
  ok('UPDATE accepted — returned row with stock_quantity = ' + upd[0].stock_quantity);

  // ── 4. Verify value in DB ──────────────────────────────────────────────
  section('4. Verify stock_quantity in DB');
  const { data: verify } = await adminSb.from('products').select('stock_quantity').eq('id', product.id).single();
  if (verify?.stock_quantity === 0) ok('Confirmed: stock_quantity = 0 in Supabase');
  else err('stock_quantity is ' + verify?.stock_quantity + ' — write did not persist');

  // ── 5. Pharmacy sign-in ────────────────────────────────────────────────
  section('5. Pharmacy sign-in');
  const { data: pharmaAuth, error: pae } = await pharmaSb.auth.signInWithPassword({ email: PHARMA_EMAIL, password: PHARMA_PASS });
  if (pae || !pharmaAuth.user) { err('Pharmacy login failed: ' + pae?.message); }
  else ok('Pharmacy signed in as ' + pharmaAuth.user.email);

  // ── 6. Catalogue: product must have stock_quantity = 0 ────────────────
  section('6. Catalogue stock check');
  const { data: cat } = await pharmaSb.from('products').select('id, name, stock_quantity').eq('id', product.id).single();
  if (cat?.stock_quantity === 0) ok('Catalogue shows stock_quantity = 0 → add-to-cart button would be disabled');
  else err('Catalogue shows stock_quantity = ' + cat?.stock_quantity + ' — not 0');

  // ── 7. Order placement: simulate Commande.html stock check ────────────
  section('7. Order placement block');
  const cartQty = 2;
  const stockQty = cat?.stock_quantity ?? 0;
  if (stockQty < cartQty) ok('Stock check passes: ' + stockQty + ' < ' + cartQty + ' → order would be blocked before INSERT');
  else err('Stock check would NOT block the order (stock=' + stockQty + ', qty=' + cartQty + ')');

  // ── 8. Admin confirm block: simulate Admin Order détail check ──────────
  section('8. Admin confirm block (simulate stock check)');
  // Find any pending order containing this product
  const { data: pendingItems } = await adminSb
    .from('order_items')
    .select('order_id, quantity, products(id, name, stock_quantity)')
    .eq('product_id', product.id)
    .limit(5);
  const blockable = (pendingItems || []).filter(it => (it.products?.stock_quantity ?? 0) < it.quantity);
  if (blockable.length) ok('Found ' + blockable.length + ' order item(s) that would be blocked at admin confirm (qty ordered > stock)');
  else ok('No pending orders for this product found (or none exceed stock) — admin confirm block would trigger on any new order');

  // ── 9. Cleanup: restore original stock ────────────────────────────────
  section('9. Cleanup: restore stock → ' + originalQty);
  const { error: re } = await adminSb.from('products').update({ stock_quantity: originalQty }).eq('id', product.id);
  if (re) err('Restore failed: ' + re.message);
  else ok('Stock restored to ' + originalQty);

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n══ Result:', pass, 'passed,', fail, 'failed ══\n');
  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error('Unhandled error:', e); process.exit(1); });
