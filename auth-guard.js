import { supabase } from './supabase-client.js'

/**
 * Call on every protected page.
 * requiredRole: 'pharmacy' | 'admin'
 * loginUrl: where to redirect if check fails (relative to current page)
 * Returns { user, profile } on success, never returns on failure (redirects).
 */
export async function guard(requiredRole, loginUrl) {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    window.location.replace(loginUrl)
    return null
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, name, pharmacy_id')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.role !== requiredRole) {
    await supabase.auth.signOut()
    window.location.replace(loginUrl)
    return null
  }

  document.body.style.visibility = 'visible'
  return { user: session.user, profile }
}
