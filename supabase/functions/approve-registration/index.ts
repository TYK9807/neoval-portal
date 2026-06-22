import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PORTAL_URL = 'https://tyk9807.github.io/neoval-portal/Login.html'

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

    // ── RESEND INVITE (no status check needed beyond approved) ───────────
    if (action === 'resend_invite') {
      if (reg.status !== 'approved') throw new Error('Registration not yet approved')

      // Try invite first; fall back to recovery link for already-confirmed users
      const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(reg.email, {
        redirectTo: PORTAL_URL,
      })

      if (inviteErr && inviteErr.message.toLowerCase().includes('already')) {
        // User already confirmed — generate a recovery (password reset) link instead
        const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email: reg.email,
          options: { redirectTo: PORTAL_URL },
        })
        if (linkErr) throw new Error(`Resend: ${linkErr.message}`)
        return new Response(JSON.stringify({
          success: true,
          action: 'resend_invite',
          mode: 'recovery_link',
          link: linkData.properties.action_link,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (inviteErr) throw new Error(`Resend: ${inviteErr.message}`)

      return new Response(JSON.stringify({
        success: true,
        action: 'resend_invite',
        mode: 'invite',
        email: reg.email,
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

    // 1. Send invite — Supabase creates the auth user and emails the activation link
    const { data: authData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(
      reg.email,
      { redirectTo: PORTAL_URL }
    )
    if (authError) throw new Error(`Invite: ${authError.message}`)

    const newUserId = authData.user.id

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

    return new Response(JSON.stringify({
      success: true,
      action: 'approved',
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
