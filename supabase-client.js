import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://nxlvdwqvkvgjvellmnic.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bHZkd3F2a3ZnanZlbGxtbmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTIwNDcsImV4cCI6MjA5NzI4ODA0N30.qF8GNEtYeZpgvQbysSVVUgUQGhZ-0ksK-LWK4KxyjJM'

// Capture auth link metadata before Supabase processes and clears the URL
;(function(){
  var h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  var q = new URLSearchParams(window.location.search)
  window._authLinkType = h.get('type') || q.get('type') || null
  // true when arriving via any invite/magic link (hash tokens or PKCE code)
  window._isAuthLink  = !!(h.get('access_token') || q.get('code'))
})()

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: window.location.pathname.includes('/admin/') ? 'nv-admin' : 'nv-pharmacy',
  }
})

// Expose for non-module scripts (e.g. admin-data.js) that run before this module.
// They check window._sb in their DOMContentLoaded handler after modules have run.
window._sb = supabase
