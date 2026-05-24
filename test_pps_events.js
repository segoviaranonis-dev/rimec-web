const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://extrlcvcgypwazxipvqm.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dHJsY3ZjZ3lwd2F6eGlwdnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjQ0NTUsImV4cCI6MjA4NDUwMDQ1NX0.Zq-uTXsAOJl5fGcqIOKFCIIUbtEYctU7UE0JJcXJsmc'

const supabase = createClient(supabaseUrl, anonKey)

async function test() {
  console.log('Querying all PPs with their intencion_compra events...')
  const { data, error } = await supabase
    .from('pedido_proveedor')
    .select(`
      id,
      numero_registro,
      id_intencion_compra,
      intencion_compra (
        id,
        precio_evento_id
      )
    `)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Found ${data.length} PPs:`)
  data.forEach(pp => {
    console.log(`PP ID: ${pp.id}, Reg: ${pp.numero_registro}, IC ID: ${pp.id_intencion_compra}, Event ID from IC: ${pp.intencion_compra?.precio_evento_id}`)
  })
}

test()
