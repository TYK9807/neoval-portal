import { supabase } from './supabase-client.js'

export async function guard(requiredRole, loginUrl) {
  try {
    const result = await supabase.auth.getSession()
    const session = result?.data?.session

    if (!session) {
      window.location.replace(loginUrl)
      return null
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profile) {
      console.error('guard: profile error', profileError)
      await supabase.auth.signOut()
      window.location.replace(loginUrl)
      return null
    }

    if (profile.role !== requiredRole) {
      await supabase.auth.signOut()
      window.location.replace(loginUrl)
      return null
    }

    document.body.style.visibility = 'visible'
    return { user: session.user, profile }

  } catch (e) {
    document.body.style.visibility = 'visible'
    document.body.innerHTML =
      '<pre style="padding:32px;color:red;font-size:13px">Guard error: ' + e.message + '\n\n' + e.stack + '</pre>'
    return null
  }
}
