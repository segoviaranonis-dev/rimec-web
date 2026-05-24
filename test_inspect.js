const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
let url = '';
let anon = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    url = line.split('=')[1].trim();
  }
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    anon = line.split('=')[1].trim();
  }
}

const supabase = createClient(url, anon);

async function run() {
  console.log('Querying precio_lista to see if caso_id is populated...');
  const { data, error } = await supabase
    .from('precio_lista')
    .select('id, caso_id, nombre_caso_aplicado')
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  console.log('Sample precio_lista rows:', data);

  const { data: countData, error: countErr } = await supabase
    .from('precio_lista')
    .select('id', { count: 'exact', head: true })
    .not('caso_id', 'is', null);

  if (countErr) {
    console.error(countErr);
  } else {
    console.log('Count of non-null caso_id in precio_lista:', countData ? countData.length : 0);
  }
}

run();
