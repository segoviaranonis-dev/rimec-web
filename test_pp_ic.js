const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://extrlcvcgypwazxipvqm.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dHJsY3ZjZ3lwd2F6eGlwdnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjQ0NTUsImV4cCI6MjA4NDUwMDQ1NX0.Zq-uTXsAOJl5fGcqIOKFCIIUbtEYctU7UE0JJcXJsmc'

const supabase = createClient(supabaseUrl, anonKey)

async function test() {
  const { data, error } = await supabase
    .from('pedido_proveedor')
    .select('id, id_intencion_compra, estado')

  if (error) {
    console.error('Error:', error)
    return
  }

  const nullIC = data.filter(r => r.id_intencion_compra === null).length
  const nonNullIC = data.filter(r => r.id_intencion_compra !== null).length

  console.log(`Total PPs: ${data.length}`)
  console.log(`PPs with id_intencion_compra = null: ${nullIC}`)
  console.log(`PPs with id_intencion_compra != null: ${nonNullIC}`)
  if (nonNullIC > 0) {
    console.log('Sample non-null IC rows:', data.filter(r => r.id_intencion_compra !== null))
  }
}

test()
