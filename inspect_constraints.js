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
  console.log('Querying pg_constraint for pedido_proveedor_detalle...');
  const { data, error } = await supabase.rpc('inspect_constraints', {});
  if (error) {
    // If the RPC inspect_constraints doesn't exist, we can use a direct SQL query or read database
    console.log('No inspect_constraints RPC, trying custom query via a public RPC or let\'s write a general SQL runner if available...');
    // Wait, is there a general SQL query RPC or is there a way to run query?
    // Let's check what functions we have
    const { data: funcs, error: funcErr } = await supabase
      .from('pg_proc')
      .select('proname')
      .limit(10);
    console.log('funcErr:', funcErr);
  } else {
    console.log('Constraints:', data);
  }
}

run();
