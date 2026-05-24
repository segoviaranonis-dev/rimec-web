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
  console.log('Consultando Intenciones de Compra (sólo id y precio_evento_id)...');
  const { data: ics, error: icsErr } = await supabase
    .from('intencion_compra')
    .select('id, precio_evento_id')
    .limit(10);
  
  if (icsErr) {
    console.error('Error ics:', icsErr);
  } else {
    console.log('Intenciones de Compra:', ics);
  }

  console.log('\nConsultando eventos de precio (precio_evento)...');
  const { data: evs, error: evsErr } = await supabase
    .from('precio_evento')
    .select('*');
  
  if (evsErr) {
    console.error('Error evs:', evsErr);
  } else {
    console.log('Eventos de precio:', evs);
  }
}

run();
