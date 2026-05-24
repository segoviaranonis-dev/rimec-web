const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://extrlcvcgypwazxipvqm.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dHJsY3ZjZ3lwd2F6eGlwdnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjQ0NTUsImV4cCI6MjA4NDUwMDQ1NX0.Zq-uTXsAOJl5fGcqIOKFCIIUbtEYctU7UE0JJcXJsmc'

const supabase = createClient(supabaseUrl, anonKey)

async function test() {
  console.log('Querying count of precio_lista by event_id...')
  const { data, error } = await supabase
    .from('precio_lista')
    .select('evento_id')

  if (error) {
    console.error('Error:', error)
    return
  }

  const counts = {}
  data.forEach(row => {
    counts[row.evento_id] = (counts[row.evento_id] || 0) + 1
  })

  console.log('Counts per event_id:', counts)
}

test()
