const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://extrlcvcgypwazxipvqm.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dHJsY3ZjZ3lwd2F6eGlwdnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjQ0NTUsImV4cCI6MjA4NDUwMDQ1NX0.Zq-uTXsAOJl5fGcqIOKFCIIUbtEYctU7UE0JJcXJsmc'

const supabase = createClient(supabaseUrl, anonKey)

async function test() {
  console.log('Testing the new pricing fallback join logic...')
  
  // Sample item detail
  const det = {
    id: 1,
    linea_id: 157,
    referencia_id: 956,
    material_id: 47826
  }

  // Fallback subquery simulation in JS:
  // SELECT pl3.evento_id FROM precio_lista pl3 JOIN precio_evento pe3 ON pe3.id = pl3.evento_id
  // WHERE pe3.estado = 'cerrado' AND pl3.linea_id = 157 AND pl3.referencia_id = 956 AND pl3.material_id = 47826
  // ORDER BY pe3.created_at DESC LIMIT 1
  
  const { data: eventRow, error: errEv } = await supabase
    .from('precio_lista')
    .select('evento_id, precio_evento!inner(estado, created_at)')
    .eq('precio_evento.estado', 'cerrado')
    .eq('linea_id', det.linea_id)
    .eq('referencia_id', det.referencia_id)
    .eq('material_id', det.material_id)
    .order('precio_evento(created_at)', { ascending: false })
    .limit(1)

  if (errEv) {
    console.error('Error finding event:', errEv)
    return
  }

  console.log('Found event row:', eventRow)

  if (eventRow && eventRow.length > 0) {
    const resolvedEventId = eventRow[0].evento_id
    console.log(`Resolved Event ID: ${resolvedEventId}`)

    // Fetch prices with resolved event ID
    const { data: priceRow, error: errPr } = await supabase
      .from('precio_lista')
      .select('lpn, lpc02, lpc03, lpc04, nombre_caso_aplicado')
      .eq('evento_id', resolvedEventId)
      .eq('linea_id', det.linea_id)
      .eq('referencia_id', det.referencia_id)
      .eq('material_id', det.material_id)
      .maybeSingle()

    console.log('Prices found:', priceRow, errPr ? errPr : '')
  } else {
    console.log('No closed event contains a price for this item.')
  }
}

test()
