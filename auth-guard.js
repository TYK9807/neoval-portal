import { supabase } from './supabase-client.js'

/**
 * Guard function for all protected pages.
 * @param {string|string[]} requiredRole  - role or array of roles allowed
 * @param {string}          loginUrl      - redirect target when auth fails
 * @returns {{ user, profile } | null}
 */
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
      .select('id, role, name, email, phone, pharmacy_id, active')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profile) {
      // Do NOT sign out here — the token may just need a refresh.
      // Destroying the refresh token would force a full re-login unnecessarily.
      // Redirect without touching the session; the login page will recover it.
      window.location.replace(loginUrl)
      return null
    }

    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!allowed.includes(profile.role)) {
      await supabase.auth.signOut()
      window.location.replace(loginUrl)
      return null
    }

    document.body.style.visibility = 'visible'

    // Wire all logout links so they call signOut() before navigating.
    // This clears the Supabase session from localStorage so the next
    // page load doesn't auto-authenticate.
    document.querySelectorAll('a.logout').forEach(link => {
      link.addEventListener('click', async e => {
        e.preventDefault()
        const href = link.getAttribute('href') || loginUrl
        await supabase.auth.signOut()
        window.location.replace(href)
      })
    })

    return { user: session.user, profile }

  } catch (e) {
    document.body.style.visibility = 'visible'
    document.body.innerHTML =
      '<pre style="padding:32px;color:red;font-size:13px">Guard error: ' + e.message + '\n\n' + e.stack + '</pre>'
    return null
  }
}
