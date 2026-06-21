-- ============================================================
-- Neoval Pharma — Supabase Storage policies
-- Bucket: 'documents' (private — create manually in Dashboard)
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run: drops existing policies before recreating.
-- ============================================================

-- Pharmacy users: download files for their own orders only
drop policy if exists "Pharmacy users can read own documents"    on storage.objects;
drop policy if exists "Pharmacy users can upload own documents"  on storage.objects;
drop policy if exists "Admins can read all documents in storage" on storage.objects;
drop policy if exists "Admins can upload documents to storage"   on storage.objects;

-- File path structure: {order_uuid}/{TYPE}-{SHORT_ID}.pdf
-- (storage.foldername(name))[1] extracts the first path segment = order_uuid

create policy "Pharmacy users can read own documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select id::text from public.orders where placed_by = auth.uid()
    )
  );

create policy "Pharmacy users can upload own documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select id::text from public.orders where placed_by = auth.uid()
    )
  );

create policy "Admins can read all documents in storage"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and public.current_user_role() = 'admin'
  );

create policy "Admins can upload documents to storage"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.current_user_role() = 'admin'
  );
