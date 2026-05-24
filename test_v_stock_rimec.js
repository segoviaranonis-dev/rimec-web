const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://extrlcvcgypwazxipvqm.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dHJsY3ZjZ3lwd2F6eGlwdnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjQ0NTUsImV4cCI6MjA4NDUwMDQ1NX0.Zq-uTXsAOJl5fGcqIOKFCIIUbtEYctU7UE0JJcXJsmc'

const supabase = createClient(supabaseUrl, anonKey)

async function test() {
  console.log('Querying all rows in pedido_proveedor...')
  const { data: pps, error } = await supabase
    .from('pedido_proveedor')
    .select('id, numero_registro, numero_proforma, id_intencion_compra, estado')

  if (error) {
    console.error('Error fetching:', error)
    return
  }

  console.log(`Total PPs: ${pps.length}`)
  pps.forEach(pp => {
    console.log(`PP ID: ${pp.id}, Reg: ${pp.numero_registro}, Proforma: ${pp.numero_proforma}, IC ID: ${pp.id_intencion_compra}, Estado: ${pp.estado}`)
  })
}

test()
