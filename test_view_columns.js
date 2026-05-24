const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://extrlcvcgypwazxipvqm.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dHJsY3ZjZ3lwd2F6eGlwdnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjQ0NTUsImV4cCI6MjA4NDUwMDQ1NX0.Zq-uTXsAOJl5fGcqIOKFCIIUbtEYctU7UE0JJcXJsmc'

const supabase = createClient(supabaseUrl, anonKey)

async function test() {
  console.log('Checking v_stock_rimec prices statistics...')
  const { data, error } = await supabase
    .from('v_stock_rimec')
    .select('*')

  if (error) {
    console.error('Error:', error)
    return
  }

  const total = data.length
  const nonNullLpn = data.filter(r => r.lpn !== null).length
  const nonNullLpc02 = data.filter(r => r.lpc02 !== null).length
  const nonNullLpc03 = data.filter(r => r.lpc03 !== null).length
  const nonNullLpc04 = data.filter(r => r.lpc04 !== null).length

  console.log(`Total rows: ${total}`)
  console.log(`Rows with lpn !== null: ${nonNullLpn}`)
  console.log(`Rows with lpc02 !== null: ${nonNullLpc02}`)
  console.log(`Rows with lpc03 !== null: ${nonNullLpc03}`)
  console.log(`Rows with lpc04 !== null: ${nonNullLpc04}`)
  
  if (total > 0) {
    console.log('\nColumns/Keys in first row:')
    console.log(Object.keys(data[0]))
  }
}

test()
