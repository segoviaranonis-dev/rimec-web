const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://extrlcvcgypwazxipvqm.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dHJsY3ZjZ3lwd2F6eGlwdnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjQ0NTUsImV4cCI6MjA4NDUwMDQ1NX0.Zq-uTXsAOJl5fGcqIOKFCIIUbtEYctU7UE0JJcXJsmc'

const supabase = createClient(supabaseUrl, anonKey)

async function test() {
  console.log('Querying precio_lista entries for linea_id: 157')
  const { data, error } = await supabase
    .from('precio_lista')
    .select('id, evento_id, linea_id, referencia_id, material_id, lpn, lpc02, lpc03, lpc04')
    .eq('linea_id', 157)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Found ${data.length} entries for linea_id 157:`, data)
}

test()
