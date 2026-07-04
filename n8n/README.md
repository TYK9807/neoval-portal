# n8n workflow reference exports

Committed **reference** copies of the four n8n workflows that power Neoval Pharma's
email automation. They are a snapshot for version history and disaster recovery —
they are **not** auto-synced with the live instance, so treat the running workflows
on n8n Cloud as the source of truth and refresh these after significant changes.

- **Instance:** `tahayassine.app.n8n.cloud`
- **Snapshot date:** 2026-07-04

| File | Workflow | Trigger | Purpose |
|------|----------|---------|---------|
| `commandes.json` | Neoval — 1. Commandes | webhook `neoval-orders` | Order lifecycle emails (new / confirmed+BL / delivered+POP) |
| `inscriptions.json` | Neoval — 2. Inscriptions | webhook `neoval-registrations` | Registration emails (new / approved+invite link / rejected) |
| `digest-quotidien.json` | Neoval — 3. Digest quotidien | cron `0 8 * * *` | Daily admin digest: stale orders (>24h) + low-stock alert |
| `digest-hebdomadaire.json` | Neoval — 4. Digest hebdomadaire | cron `0 9 * * 1` | Weekly KPI report + inactive-pharmacy re-engagement |

## Secrets

These exports are safe for a public repo:

- **Credentials are referenced by id/name only** — the Gmail OAuth2 credential and the
  webhook Header Auth credential (`Neoval Webhook Token`) carry no token values in the JSON.
- **The Supabase anon key** embedded in the HTTP Request node headers has been replaced
  with the placeholder `<SUPABASE_ANON_KEY>`. It is the public, RLS-protected anon key
  (the same one shipped in the client HTML), but it is redacted here to keep credentials
  out of these files. Restore it in the HTTP nodes' `apikey` / `Authorization: Bearer …`
  headers if re-importing.
- The webhook Header Auth shared secret lives only in **Supabase Vault** + the n8n
  credential store; it never appears here (see `../supabase/n8n_triggers.sql`).

## Webhook payload contract

Both webhook workflows expect Supabase's native Database Webhook envelope, delivered by
the pg_net triggers in `../supabase/n8n_triggers.sql`:

```json
{ "type": "INSERT" | "UPDATE", "table": "<name>", "record": { ...new row... }, "old_record": { ...old row... } | null }
```

The n8n Webhook node wraps the POST body under a `body` key, so the Classifier code reads
`$input.first().json.body` (falling back to the flat object).

## Daily digest — two structural bugs fixed 2026-07-04

Both only surfaced via a real manual run (schedule-only workflow, no way to catch them
statically), and both are reflected in `digest-quotidien.json`:

1. **Empty low-stock branch aborted the whole digest.** The flow was a linear chain
   `Traiter commandes en attente → Stock faible → Construire digest → …`. The `Stock faible`
   HTTP node splits its JSON-array response into items, so an empty low-stock result
   (`[]`, the normal state) emitted **0 items**, and n8n skips every downstream node fed
   0 items — so the digest never built or sent, even with stale orders queued.
   **Fix:** rewired `Traiter commandes en attente → [Stock faible, Construire digest]`
   (Stock faible listed first so it still runs), making `Stock faible` a leaf; and
   `Construire digest` now reads low-stock via `$('Stock faible').all().map(i => i.json)`
   instead of `$input`.

2. **Stale-order count was always 0.** `Traiter commandes en attente` did
   `const raw = $input.first().json; const allOrders = Array.isArray(raw) ? raw : []`, but
   the HTTP node had already split the orders array into one item per order, so `raw` was a
   single order object, `Array.isArray(raw)` was false, and `allOrders` was always `[]` →
   `staleCount` always 0 → the `hasContent` gate never passed.
   **Fix:** `const allOrders = $input.all().map(i => i.json)`.

Verified live (execution 536): low-stock empty **and** 8 genuinely-stale orders present →
`staleCount=8` → `hasContent=true` → `Email Admin Digest` sent (`labelIds: ["SENT"]`).
