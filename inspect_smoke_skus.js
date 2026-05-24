const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
let url = '';
let service_role = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    url = line.split('=')[1].trim();
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    service_role = line.split('=')[1].trim();
  }
}

const supabase = createClient(url, service_role);

async function run() {
  const { count, error: countErr } = await supabase
    .from('v_stock_rimec')
    .select('*', { count: 'exact', head: true });
  
  if (countErr) {
    console.error('Error count:', countErr);
    return;
  }
  
  console.log(`Total registros en v_stock_rimec: ${count}`);

  const { data: skus, error } = await supabase
    .from('v_stock_rimec')
    .select('det_id, descp_caso, lpn')
    .limit(10);

  console.log('\nMuestra de 10 registros de v_stock_rimec:');
  console.log(skus);

  // Ver si hay registros en precio_lista
  const { count: plCount, error: plErr } = await supabase
    .from('precio_lista')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total registros en precio_lista: ${plCount}`);

  // Ver si hay algún precio_lista con lpn > 0
  const { data: plSample, error: plSampleErr } = await supabase
    .from('precio_lista')
    .select('id, evento_id, lpn, nombre_caso_aplicado')
    .gt('lpn', 0)
    .limit(5);

  console.log('\nMuestra de precio_lista con lpn > 0:');
  console.log(plSample);

  // Ver si hay eventos
  const { data: eventos, error: evErr } = await supabase
    .from('precio_evento')
    .select('id, descp_evento, activo');
  
  console.log('\nEventos de precio:');
  console.log(eventos);
}

run();
