import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://nxlvdwqvkvgjvellmnic.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bHZkd3F2a3ZnanZlbGxtbmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTIwNDcsImV4cCI6MjA5NzI4ODA0N30.qF8GNEtYeZpgvQbysSVVUgUQGhZ-0ksK-LWK4KxyjJM'

export const supabase = createClient(supabaseUrl, supabaseKey)
