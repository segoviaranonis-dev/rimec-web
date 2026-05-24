const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer variables de entorno desde .env.local
const envPath = path.join(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('No se encontró el archivo .env.local en', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
let url = '';
let anon = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    url = line.split('=')[1].trim().replace(/['"]/g, '');
  }
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    anon = line.split('=')[1].trim().replace(/['"]/g, '');
  }
}

console.log('Iniciando cliente Supabase...');
const supabase = createClient(url, anon);

async function run() {
  console.log('\n--- INICIANDO PRUEBA DE INTEGRACIÓN DE RESTRICCIÓN DE ROL ---');

  // 1. Obtener un cliente y plazo existentes para poder insertar el pedido de prueba
  const { data: clientes, error: cliErr } = await supabase
    .from('cliente_v2')
    .select('id_cliente')
    .limit(1);

  if (cliErr || !clientes || clientes.length === 0) {
    console.error('Error al obtener cliente para la prueba:', cliErr);
    process.exit(1);
  }
  const idCliente = clientes[0].id_cliente;

  const { data: plazos, error: plzErr } = await supabase
    .from('plazo_v2')
    .select('id_plazo')
    .limit(1);

  if (plzErr || !plazos || plazos.length === 0) {
    console.error('Error al obtener plazo para la prueba:', plzErr);
    process.exit(1);
  }
  const idPlazo = plazos[0].id_plazo;

  console.log(`Usando Cliente ID: ${idCliente}, Plazo ID: ${idPlazo}`);

  // 2. Crear un usuario de prueba con rol 'OPERARIO' (rol_id = 4)
  // Nota: id_usuario lo especificaremos manualmente para evitar colisiones
  const testUserId = 99999;
  
  // Limpiar si existía antes
  await supabase.from('usuario_v2').delete().eq('id_usuario', testUserId);

  console.log('Insertando usuario de prueba OPERARIO...');
  const { error: userErr } = await supabase
    .from('usuario_v2')
    .insert({
      id_usuario: testUserId,
      descp_usuario: 'TEST_OPERARIO_RBAC',
      categoria: 'OPERARIO',
      rol_id: 4, // OPERARIO
      password: 'testpassword'
    });

  if (userErr) {
    console.error('Error al crear usuario OPERARIO:', userErr);
    process.exit(1);
  }
  console.log('Usuario de prueba OPERARIO creado exitosamente.');

  // 3. Intentar insertar un pedido de venta referenciando a este usuario con rol no permitido
  console.log('Intentando insertar pedido de venta con vendedor OPERARIO (debe fallar)...');
  const { data: orderData, error: orderErr } = await supabase
    .from('pedido_venta_rimec')
    .insert({
      cliente_id: idCliente,
      plazo_id: idPlazo,
      vendedor_id: testUserId,
      descuento_1: 0,
      descuento_2: 0,
      descuento_3: 0,
      descuento_4: 0,
      total_pares: 10,
      total_monto: 50000,
      payload_json: {},
      nro_pedido: 'PVR-TEST-FAIL-' + Date.now(),
      estado: 'PENDIENTE'
    })
    .select('id');

  if (orderErr) {
    console.log('✅ Inserción falló correctamente como se esperaba!');
    console.log('Mensaje de error recibido:', orderErr.message);
    if (orderErr.message.includes('chk_vendedor_rol')) {
      console.log('✅ El error menciona la restricción chk_vendedor_rol!');
    } else {
      console.warn('⚠️ La inserción falló pero el mensaje no menciona chk_vendedor_rol. Verificar:', orderErr);
    }
  } else {
    console.error('❌ ERROR: Se permitió insertar un pedido con un vendedor con rol OPERARIO!');
    // Limpiar el pedido mal insertado
    if (orderData && orderData.length > 0) {
      await supabase.from('pedido_venta_rimec').delete().eq('id', orderData[0].id);
    }
  }

  // 4. Cambiar el rol del usuario de prueba a 'VENDEDOR' (rol_id = 3)
  console.log('\nActualizando rol del usuario de prueba a VENDEDOR (rol_id = 3)...');
  const { error: updErr } = await supabase
    .from('usuario_v2')
    .update({ rol_id: 3, categoria: 'VENDEDOR' })
    .eq('id_usuario', testUserId);

  if (updErr) {
    console.error('Error al actualizar rol de usuario:', updErr);
    // Limpiar usuario
    await supabase.from('usuario_v2').delete().eq('id_usuario', testUserId);
    process.exit(1);
  }

  // 5. Intentar insertar el pedido de venta nuevamente (ahora debe tener éxito)
  console.log('Intentando insertar pedido de venta con vendedor VENDEDOR (ahora debe tener éxito)...');
  const testNroPedido = 'PVR-TEST-OK-' + Date.now();
  const { data: orderData2, error: orderErr2 } = await supabase
    .from('pedido_venta_rimec')
    .insert({
      cliente_id: idCliente,
      plazo_id: idPlazo,
      vendedor_id: testUserId,
      descuento_1: 0,
      descuento_2: 0,
      descuento_3: 0,
      descuento_4: 0,
      total_pares: 10,
      total_monto: 50000,
      payload_json: {},
      nro_pedido: testNroPedido,
      estado: 'PENDIENTE'
    })
    .select('id');

  let orderIdToDelete = null;
  if (orderErr2) {
    console.error('❌ ERROR: Falló la inserción del pedido con vendedor autorizado:', orderErr2);
  } else {
    console.log('✅ Inserción de pedido exitosa con vendedor con rol VENDEDOR!');
    orderIdToDelete = orderData2[0].id;
  }

  // 6. Limpieza
  console.log('\nLimpiando datos de prueba...');
  if (orderIdToDelete) {
    const { error: delOrderErr } = await supabase
      .from('pedido_venta_rimec')
      .delete()
      .eq('id', orderIdToDelete);
    if (delOrderErr) console.error('Error al eliminar pedido de prueba:', delOrderErr);
    else console.log('Pedido de prueba eliminado.');
  }

  const { error: delUserErr } = await supabase
    .from('usuario_v2')
    .delete()
    .eq('id_usuario', testUserId);
  if (delUserErr) console.error('Error al eliminar usuario de prueba:', delUserErr);
  else console.log('Usuario de prueba eliminado.');

  console.log('\n--- PRUEBA DE INTEGRACIÓN TERMINADA ---');
}

run();
