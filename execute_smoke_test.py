import psycopg2
import json
from datetime import datetime

conn = psycopg2.connect(
    host='aws-1-sa-east-1.pooler.supabase.com',
    port=6543,
    dbname='postgres',
    user='postgres.extrlcvcgypwazxipvqm',
    password='IJoFJbT8Qj0Q0w5m'
)
cur = conn.cursor()

try:
    print("=== SMOKE TEST: INICIO DE EJECUCION ===")

    # 1. Obtener valores originales de pares_vendidos
    cur.execute("SELECT id, pares_vendidos FROM pedido_proveedor_detalle WHERE id IN (1, 32, 60)")
    original_stock = {row[0]: row[1] for row in cur.fetchall()}
    print(f"Pares vendidos originales: {original_stock}")

    # 2. Asociar PP ID 1 a IC ID 1
    print("\n[Paso 1] Asociando PP ID 1 a Intencion Compra ID 1...")
    cur.execute("UPDATE pedido_proveedor SET id_intencion_compra = 1 WHERE id = 1")
    conn.commit()
    print("PP ID 1 actualizado con éxito.")

    # 3. Construir Payload
    print("\n[Paso 2] Construyendo payload del carrito...")
    
    # 3 SKUs de marcas distintas:
    # det_id: 60 (ACTVITTA), LPN: 145300, caso_id: 6, caso: 'ACT-BRSPORT'
    # det_id: 32 (BR SPORT), LPN: 223000, caso_id: 6, caso: 'ACT-BRSPORT'
    # det_id: 1 (MOLEKINHA), LPN: 133300, caso_id: 7, caso: 'BR-VZ-MD-ML-MKA-O'
    
    total_pares = 24 # 8 pares por SKU (1 caja cada uno)
    total_monto = (133300 * 8) + (223000 * 8) + (145300 * 8) # = 1,066,400 + 1,784,000 + 1,162,400 = 4,012,800
    
    payload = {
        "cliente_id": 5000,
        "cliente_nombre": "PRUEBA WEB NEXUS",
        "vendedor_id": 5,
        "vendedor_nombre": "DIRECTOR",
        "plazo_id": 1,
        "plazo_nombre": "EFECTIVO",
        "lista_precio_id": 1,
        "lista_nombre": "LPN",
        "descuento_1": 0,
        "descuento_2": 0,
        "descuento_3": 0,
        "descuento_4": 0,
        "total_pares": total_pares,
        "total_neto": total_monto,
        "fecha": datetime.utcnow().isoformat() + "Z",
        "lotes": [
            {
                "pp_id": 1,
                "pp_nro": "PP-2026-0001",
                "quincena": "JUNIO I 2026",
                "eta": "2026-06-15",
                "total_pares": total_pares,
                "total_monto": total_monto,
                "facturas": [
                    {
                        "marca": "ACTVITTA",
                        "marca_id": 7,
                        "caso": "ACT-BRSPORT",
                        "caso_id": 6,
                        "total_pares": 8,
                        "total_monto": 1162400,
                        "items": [
                            {
                                "det_id": 60,
                                "linea_codigo": "4202",
                                "ref_codigo": "565",
                                "color_nombre": "NEGRO 01-NEGRO 01",
                                "gradas_fmt": "34-39",
                                "imagen_url": "https://extrlcvcgypwazxipvqm.supabase.co/storage/v1/object/public/productos/4202-565-31855-39218.jpg",
                                "cajas": 1,
                                "pares": 8,
                                "precio_base": 145300,
                                "precio_neto": 145300,
                                "subtotal": 1162400
                            }
                        ]
                    },
                    {
                        "marca": "BR SPORT",
                        "marca_id": 8,
                        "caso": "ACT-BRSPORT",
                        "caso_id": 6,
                        "total_pares": 8,
                        "total_monto": 1784000,
                        "items": [
                            {
                                "det_id": 32,
                                "linea_codigo": "2272",
                                "ref_codigo": "222",
                                "color_nombre": "CAFE 569",
                                "gradas_fmt": "38-43",
                                "imagen_url": "https://extrlcvcgypwazxipvqm.supabase.co/storage/v1/object/public/productos/2272-222-27615-43747.jpg",
                                "cajas": 1,
                                "pares": 8,
                                "precio_base": 223000,
                                "precio_neto": 223000,
                                "subtotal": 1784000
                            }
                        ]
                    },
                    {
                        "marca": "MOLEKINHA",
                        "marca_id": 5,
                        "caso": "BR-VZ-MD-ML-MKA-O",
                        "caso_id": 7,
                        "total_pares": 8,
                        "total_monto": 1066400,
                        "items": [
                            {
                                "det_id": 1,
                                "linea_codigo": "2083",
                                "ref_codigo": "1122",
                                "color_nombre": "ORO ROSADO",
                                "gradas_fmt": "25-29",
                                "imagen_url": "https://extrlcvcgypwazxipvqm.supabase.co/storage/v1/object/public/productos/2083-1122-30579-23146.jpg",
                                "cajas": 1,
                                "pares": 8,
                                "precio_base": 133300,
                                "precio_neto": 133300,
                                "subtotal": 1066400
                            }
                        ]
                    }
                ]
            }
        ]
    }

    # 4. Invocar RPC
    print("\n[Paso 3] Invocando RPC confirmar_pedido_web...")
    start_time = datetime.now()
    cur.execute("""
        SELECT public.confirmar_pedido_web(
            %s::bigint, %s::bigint, %s::bigint, %s::integer,
            %s::numeric, %s::numeric, %s::numeric, %s::numeric,
            %s::integer, %s::numeric, %s::jsonb
        )
    """, (
        5000, 5, 1, 1,
        0, 0, 0, 0,
        total_pares, total_monto, json.dumps(payload)
    ))
    res = cur.fetchone()[0]
    duration = (datetime.now() - start_time).total_seconds()
    print(f"Respuesta del RPC (duración {duration:.3f}s):")
    print(json.dumps(res, indent=2))

    if not res.get("success"):
        raise Exception(f"RPC devolvió error: {res.get('error')}")

    pedido_id = res.get("pedido_id")
    nro_pedido = res.get("nro_pedido")
    facturas_creadas = res.get("facturas", [])

    # 5. Validar inserciones y persistencia exacta del caso y caso_id
    print("\n[Paso 4] Validando persistencia en Base de Datos...")
    
    # Cabecera pedido
    cur.execute("SELECT id, nro_pedido, estado, total_pares, total_monto FROM pedido_venta_rimec WHERE id = %s", (pedido_id,))
    p_row = cur.fetchone()
    print(f"Pedido Venta insertado: ID={p_row[0]}, Nro={p_row[1]}, Estado={p_row[2]}, Pares={p_row[3]}, Monto={p_row[4]}")
    
    # Facturas internas generadas
    fi_ids = [f["fi_id"] for f in facturas_creadas]
    print(f"Facturas creadas IDs: {fi_ids}")
    
    cur.execute("""
        SELECT id, nro_factura, marca, marca_id, caso, caso_id, total_pares, total_monto, estado
        FROM factura_interna
        WHERE id IN %s
    """, (tuple(fi_ids),))
    
    invoices = cur.fetchall()
    print("\nFacturas Internas en DB:")
    for inv in invoices:
        print(f" - ID={inv[0]}, Nro={inv[1]}, Marca={inv[2]} (ID: {inv[3]}), Caso='{inv[4]}' (ID: {inv[5]}), Pares={inv[6]}, Monto={inv[7]}, Estado={inv[8]}")
        # Comprobar que caso y caso_id coinciden exactamente con lo enviado
        matched_payload = None
        for lot in payload["lotes"]:
            for fac in lot["facturas"]:
                if fac["marca"] == inv[2]:
                    matched_payload = fac
                    break
        if matched_payload:
            assert inv[4] == matched_payload["caso"], f"Caso no coincide: DB='{inv[4]}' vs Payload='{matched_payload['caso']}'"
            expected_master_id = 3 if inv[4] == 'ACT-BRSPORT' else 1
            assert inv[5] == expected_master_id, f"Caso ID no coincide: DB={inv[5]} vs Esperado={expected_master_id}"
            print(f"   => OK: Caso '{inv[4]}' e ID {inv[5]} grabados y resueltos correctamente.")
        else:
            print("   => ADVERTENCIA: No se pudo relacionar la factura con el payload original")

    # Verificar detalles de factura interna
    cur.execute("""
        SELECT id, factura_id, ppd_id, cajas, pares, precio_lista, precio_neto, subtotal, linea_snapshot
        FROM factura_interna_detalle
        WHERE factura_id IN %s
    """, (tuple(fi_ids),))
    details = cur.fetchall()
    print(f"\nDetalles de Facturas Internas en DB ({len(details)} filas):")
    for det in details:
        print(f" - Detalle ID={det[0]}, Factura ID={det[1]}, PPD ID={det[2]}, Cajas={det[3]}, Pares={det[4]}, Base={det[5]}, Neto={det[6]}, Subtotal={det[7]}")
        print(f"   Snapshot: {json.dumps(det[8])}")

    # Verificar descuento de stock en pedido_proveedor_detalle
    cur.execute("SELECT id, pares_vendidos FROM pedido_proveedor_detalle WHERE id IN (1, 32, 60)")
    new_stock = {row[0]: row[1] for row in cur.fetchall()}
    print(f"\nNuevo stock de pares vendidos en DB: {new_stock}")
    for id_det, p_orig in original_stock.items():
        p_new = new_stock[id_det]
        assert p_new == p_orig + 8, f"El stock no se descontó correctamente para det_id {id_det}: orig={p_orig}, new={p_new}, esperado={p_orig + 8}"
    print(" => OK: Descuento de stock en tránsito validado correctamente (+8 pares en cada SKU).")

    # 6. Limpieza y Reversión
    print("\n[Paso 5] Iniciando Limpieza y Reversion...")
    
    # Eliminar detalles de facturas
    cur.execute("DELETE FROM factura_interna_detalle WHERE factura_id IN %s", (tuple(fi_ids),))
    print(f"Detalles de facturas eliminados: {cur.rowcount} filas.")
    
    # Eliminar facturas
    cur.execute("DELETE FROM factura_interna WHERE id IN %s", (tuple(fi_ids),))
    print(f"Facturas eliminadas: {cur.rowcount} filas.")
    
    # Eliminar pedido
    cur.execute("DELETE FROM pedido_venta_rimec WHERE id = %s", (pedido_id,))
    print(f"Pedido eliminado: {cur.rowcount} filas.")
    
    # Revertir stock de pares_vendidos
    for id_det, p_orig in original_stock.items():
        cur.execute("UPDATE pedido_proveedor_detalle SET pares_vendidos = %s WHERE id = %s", (p_orig, id_det))
    print("Stock de pares_vendidos restablecido a sus valores originales.")
    
    # Desvincular PP ID 1 de IC ID 1
    cur.execute("UPDATE pedido_proveedor SET id_intencion_compra = NULL WHERE id = 1")
    print("PP ID 1 desvinculado de Intención de Compra (id_intencion_compra = NULL).")
    
    conn.commit()
    print("\n=== SMOKE TEST COMPLETADO CON EXITO Y LIMPIO ===")

except Exception as e:
    print("\n[ERROR EN EL SMOKE TEST]:", e)
    conn.rollback()
finally:
    conn.close()
