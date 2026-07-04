import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PORTAL_URL = 'https://tyk9807.github.io/neoval-portal/Login.html'
const N8N_REG_WEBHOOK = 'https://tahayassine.app.n8n.cloud/webhook/neoval-registrations'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Verify caller identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    const { data: callerProfile } = await adminClient
      .from('users').select('role').eq('id', user.id).single()
    if (!callerProfile || callerProfile.role !== 'admin') throw new Error('Forbidden')

    const { registration_id, action } = await req.json()
    if (!registration_id || !action) throw new Error('Missing registration_id or action')

    const { data: reg, error: regError } = await adminClient
      .from('pending_registrations').select('*').eq('id', registration_id).single()
    if (regError || !reg) throw new Error('Registration not found')

    // ── RESEND INVITE ────────────────────────────────────────────────────
    if (action === 'resend_invite') {
      if (reg.status !== 'approved') throw new Error('Registration not yet approved')

      // Re-stamp needs_password so the pharmacy user gets passwordless mode
      // when they click the link — covers users created before this flag existed.
      const { data: userData } = await adminClient
        .from('users').select('id').eq('email', reg.email).single()
      if (userData?.id) {
        await adminClient.auth.admin.updateUserById(userData.id, {
          user_metadata: { needs_password: true },
        })
      }

      // Generate a magic link — no email sent, admin copies and shares manually
      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: reg.email,
        options: { redirectTo: PORTAL_URL },
      })
      if (linkErr) throw new Error(`Resend: ${linkErr.message}`)
      return new Response(JSON.stringify({
        success: true,
        action: 'resend_invite',
        mode: 'magic_link',
        link: linkData.properties.action_link,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Status guard for approve/reject
    if (reg.status !== 'pending') throw new Error(`Already ${reg.status}`)

    // ── REJECT ──────────────────────────────────────────────────────────
    if (action === 'reject') {
      await adminClient.from('pending_registrations').update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      }).eq('id', registration_id)

      return new Response(JSON.stringify({ success: true, action: 'rejected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action !== 'approve') throw new Error('Invalid action')

    // ── APPROVE ─────────────────────────────────────────────────────────

    // 1. Generate invite link — creates auth user, returns URL to share (no email sent)
    const { data: linkData, error: authError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: reg.email,
      options: { redirectTo: PORTAL_URL },
    })
    if (authError) throw new Error(`Invite: ${authError.message}`)

    const newUserId = linkData.user.id
    const inviteLink = linkData.properties.action_link

    // 2. Create pharmacy record
    const { data: pharmacy, error: pharmError } = await adminClient
      .from('pharmacies')
      .insert({ name: reg.pharmacy_name, address: reg.address, ice_number: reg.ice_number })
      .select('id').single()
    if (pharmError) {
      await adminClient.auth.admin.deleteUser(newUserId)
      throw new Error(`Pharmacy: ${pharmError.message}`)
    }

    // 3. Create users record
    const { error: userInsertError } = await adminClient.from('users').insert({
      id: newUserId,
      email: reg.email,
      name: reg.contact_name,
      role: 'pharmacy',
      phone: reg.phone,
      pharmacy_id: pharmacy.id,
    })

    // 3b. Mark user as needing password setup (stored in auth.users.user_metadata)
    await adminClient.auth.admin.updateUserById(newUserId, {
      user_metadata: { needs_password: true },
    })
    if (userInsertError) {
      await adminClient.auth.admin.deleteUser(newUserId)
      await adminClient.from('pharmacies').delete().eq('id', pharmacy.id)
      throw new Error(`User record: ${userInsertError.message}`)
    }

    // 4. Mark approved
    await adminClient.from('pending_registrations').update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq('id', registration_id)

    // 5. Dispatch the single approval email through n8n, with the invite link
    //    embedded. The link is a credential: it is sent over HTTPS in the request
    //    body only (never in a URL, never written to the DB, never logged here).
    //    The DB trigger deliberately skips the 'approved' transition, so this is
    //    the sole sender of the approval email and there is no duplicate.
    //    The webhook auth token lives only in Supabase Vault (single source of
    //    truth) and is read via a service_role-only RPC.
    try {
      // Token read is best-effort: if the RPC/Vault secret isn't in place yet,
      // fall back to an empty header rather than aborting the email. An empty
      // header only matters once the webhook enforces Header Auth (the final
      // cutover step), by which point the secret is guaranteed to exist.
      let webhookToken = ''
      try {
        const { data: tokenData } = await adminClient.rpc('get_n8n_webhook_token')
        if (tokenData) webhookToken = tokenData as string
      } catch (_) { /* leave webhookToken empty */ }

      await fetch(N8N_REG_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Neoval-Webhook-Token': webhookToken,
        },
        body: JSON.stringify({
          type: 'UPDATE',
          table: 'pending_registrations',
          record: {
            pharmacy_name: reg.pharmacy_name,
            contact_name: reg.contact_name,
            email: reg.email,
            phone: reg.phone,
            address: reg.address,
            status: 'approved',
          },
          old_record: { status: 'pending' },
          invite_link: inviteLink,
        }),
      })
    } catch (n8nErr) {
      // Non-fatal: the account is already created and the admin UI still shows
      // the invite link for manual sharing. Never log the link itself.
      console.error('n8n approval email dispatch failed:', (n8nErr as Error).message)
    }

    return new Response(JSON.stringify({
      success: true,
      action: 'approved',
      invite_link: inviteLink,
      email: reg.email,
      pharmacy_name: reg.pharmacy_name,
      contact_name: reg.contact_name,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
