const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://extrlcvcgypwazxipvqm.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dHJsY3ZjZ3lwd2F6eGlwdnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjQ0NTUsImV4cCI6MjA4NDUwMDQ1NX0.Zq-uTXsAOJl5fGcqIOKFCIIUbtEYctU7UE0JJcXJsmc'

const supabase = createClient(supabaseUrl, anonKey)

async function test() {
  console.log('1. Querying precio_evento...')
  const { data: eventos, error: errEv } = await supabase
    .from('precio_evento')
    .select('*')
    .order('created_at', { ascending: false })

  if (errEv) {
    console.error('Error fetching precio_evento:', errEv)
  } else {
    console.log('Success! Eventos:', eventos)
  }

  console.log('2. Querying precio_lista row count...')
  const { count, error: errCt } = await supabase
    .from('precio_lista')
    .select('*', { count: 'exact', head: true })

  if (errCt) {
    console.error('Error counting precio_lista:', errCt)
  } else {
    console.log(`Success! Total rows in precio_lista: ${count}`)
  }

  console.log('3. Sample rows from precio_lista...')
  const { data: plRows, error: errPl } = await supabase
    .from('precio_lista')
    .select('id, evento_id, linea_id, referencia_id, material_id, lpn, lpc02, lpc03, lpc04')
    .limit(5)

  if (errPl) {
    console.error('Error fetching precio_lista sample:', errPl)
  } else {
    console.log('Success! Sample rows:', plRows)
  }
}

test()
