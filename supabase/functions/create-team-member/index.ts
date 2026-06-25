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

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    const { data: callerProfile } = await adminClient
      .from('users').select('role').eq('id', user.id).single()
    if (!callerProfile || callerProfile.role !== 'admin') throw new Error('Forbidden')

    const { name, email, phone, role } = await req.json()
    if (!name || !email || !role) throw new Error('Missing required fields')
    if (!['admin', 'sales_rep', 'delivery'].includes(role)) throw new Error('Invalid role')

    const tempPassword = 'Neoval' + Math.floor(100000 + Math.random() * 900000)

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })
    if (authError) throw new Error(`Auth: ${authError.message}`)

    const newUserId = authData.user.id

    const { error: insertError } = await adminClient.from('users').insert({
      id: newUserId,
      email,
      name,
      role,
      phone: phone || null,
      active: true,
    })

    if (insertError) {
      await adminClient.auth.admin.deleteUser(newUserId)
      throw new Error(`User record: ${insertError.message}`)
    }

    return new Response(JSON.stringify({
      success: true,
      temp_password: tempPassword,
      email,
      name,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
