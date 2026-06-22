import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Privileged client for creating auth users and writing records
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Verify caller identity via their JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    // Verify caller is an admin in public.users
    const { data: callerProfile } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!callerProfile || callerProfile.role !== 'admin') throw new Error('Forbidden')

    const { registration_id, action } = await req.json()
    if (!registration_id || !action) throw new Error('Missing registration_id or action')

    // Fetch the registration
    const { data: reg, error: regError } = await adminClient
      .from('pending_registrations')
      .select('*')
      .eq('id', registration_id)
      .single()
    if (regError || !reg) throw new Error('Registration not found')
    if (reg.status !== 'pending') throw new Error(`Already ${reg.status}`)

    // ── REJECT ──────────────────────────────────────────────
    if (action === 'reject') {
      await adminClient
        .from('pending_registrations')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', registration_id)

      // Optional: n8n rejection email
      const n8nUrl = Deno.env.get('N8N_REJECTION_WEBHOOK')
      if (n8nUrl) {
        await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: reg.email,
            contact_name: reg.contact_name,
            pharmacy_name: reg.pharmacy_name,
          }),
        }).catch(() => {})
      }

      return new Response(JSON.stringify({ success: true, action: 'rejected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action !== 'approve') throw new Error('Invalid action')

    // ── APPROVE ─────────────────────────────────────────────
    const digits = Math.floor(1000 + Math.random() * 9000)
    const tempPassword = `Pharma${digits}!`

    // 1. Create Supabase Auth account
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: reg.email,
      password: tempPassword,
      email_confirm: true,
    })
    if (authError) throw new Error(`Auth: ${authError.message}`)

    const newUserId = authData.user.id

    // 2. Create pharmacy record
    const { data: pharmacy, error: pharmError } = await adminClient
      .from('pharmacies')
      .insert({
        name: reg.pharmacy_name,
        address: reg.address,
        ice_number: reg.ice_number,
      })
      .select('id')
      .single()
    if (pharmError) {
      await adminClient.auth.admin.deleteUser(newUserId)
      throw new Error(`Pharmacy: ${pharmError.message}`)
    }

    // 3. Create users record linked to the new auth user
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

    // 4. Mark registration as approved
    await adminClient
      .from('pending_registrations')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', registration_id)

    // 5. Optional: n8n webhook to send welcome email with credentials
    const n8nUrl = Deno.env.get('N8N_APPROVAL_WEBHOOK')
    if (n8nUrl) {
      await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: reg.email,
          contact_name: reg.contact_name,
          pharmacy_name: reg.pharmacy_name,
          temp_password: tempPassword,
          portal_url: 'https://neovalpharma.ma/Login.html',
        }),
      }).catch(() => {})
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: 'approved',
        email: reg.email,
        temp_password: tempPassword,
        pharmacy_name: reg.pharmacy_name,
        contact_name: reg.contact_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
