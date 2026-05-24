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

const ORDER_NRO = 'PVR-2026-879196';
const TARGET_INVOICE_IDS = [1, 2, 3, 4, 5]; // The specific IDs we saw in the printout

async function run() {
  console.log(`Searching for order: ${ORDER_NRO}...`);
  const { data: orders, error: oErr } = await supabase
    .from('pedido_venta_rimec')
    .select('*')
    .eq('nro_pedido', ORDER_NRO);

  if (oErr) {
    console.error('Error fetching order:', oErr);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log('Order not found!');
    return;
  }

  const order = orders[0];
  console.log('Found order:', {
    id: order.id,
    nro_pedido: order.nro_pedido,
    cliente_id: order.cliente_id,
    total_pares: order.total_pares,
    total_monto: order.total_monto,
    estado: order.estado
  });

  // Find associated invoices
  const { data: invoices, error: iErr } = await supabase
    .from('factura_interna')
    .select('*')
    .in('id', TARGET_INVOICE_IDS);

  if (iErr) {
    console.error('Error fetching invoices:', iErr);
    return;
  }

  console.log(`Found ${invoices.length} invoices:`);
  for (const inv of invoices) {
    console.log(`- Invoice ID: ${inv.id}, Nro: ${inv.nro_factura}, Marca: ${inv.marca}, Caso: ${inv.caso}, Pares: ${inv.total_pares}, Estado: ${inv.estado}`);
  }

  // Fetch details of all these invoices
  const { data: details, error: dErr } = await supabase
    .from('factura_interna_detalle')
    .select('*')
    .in('factura_id', TARGET_INVOICE_IDS);

  if (dErr) {
    console.error('Error fetching invoice details:', dErr);
    return;
  }

  console.log(`Found ${details.length} detail rows to process for stock restoration:`);
  for (const det of details) {
    console.log(`- Detail ID: ${det.id}, factura_id: ${det.factura_id}, ppd_id: ${det.ppd_id}, pares: ${det.pares}`);
  }

  console.log('\n--- RESTORATION AND DELETION ---');
  // Revert stock:
  for (const det of details) {
    if (det.ppd_id && det.pares > 0) {
      console.log(`Restoring stock for ppd_id=${det.ppd_id}: subtracting ${det.pares} pares...`);
      // Get current pares_vendidos
      const { data: ppd, error: ppdErr } = await supabase
        .from('pedido_proveedor_detalle')
        .select('pares_vendidos')
        .eq('id', det.ppd_id)
        .single();
      
      if (ppdErr) {
        console.error(`Error reading ppd_id=${det.ppd_id}:`, ppdErr);
        continue;
      }
      
      const newParesVendidos = Math.max(0, (ppd.pares_vendidos || 0) - det.pares);
      console.log(`Current pares_vendidos: ${ppd.pares_vendidos}, updating to: ${newParesVendidos}`);
      
      const { error: updErr } = await supabase
        .from('pedido_proveedor_detalle')
        .update({ pares_vendidos: newParesVendidos })
        .eq('id', det.ppd_id);
      
      if (updErr) {
        console.error(`Error updating ppd_id=${det.ppd_id}:`, updErr);
      } else {
        console.log(`Successfully updated ppd_id=${det.ppd_id}`);
      }
    }
  }

  // Delete details
  console.log(`Deleting ${details.length} rows from factura_interna_detalle...`);
  const { error: delDetErr } = await supabase
    .from('factura_interna_detalle')
    .delete()
    .in('factura_id', TARGET_INVOICE_IDS);
  if (delDetErr) console.error('Error deleting details:', delDetErr);
  else console.log('Successfully deleted details.');

  // Delete invoices
  console.log(`Deleting ${invoices.length} rows from factura_interna...`);
  const { error: delInvErr } = await supabase
    .from('factura_interna')
    .delete()
    .in('id', TARGET_INVOICE_IDS);
  if (delInvErr) console.error('Error deleting invoices:', delInvErr);
  else console.log('Successfully deleted invoices.');

  // Delete order
  console.log(`Deleting order ${ORDER_NRO}...`);
  const { error: delOrdErr } = await supabase
    .from('pedido_venta_rimec')
    .delete()
    .eq('id', order.id);
  if (delOrdErr) console.error('Error deleting order:', delOrdErr);
  else console.log('Successfully deleted order.');

  console.log('Cleanup completed successfully!');
}

run();
