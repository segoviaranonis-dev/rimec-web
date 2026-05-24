import psycopg2

conn = psycopg2.connect(
    host='aws-1-sa-east-1.pooler.supabase.com',
    port=6543,
    dbname='postgres',
    user='postgres.extrlcvcgypwazxipvqm',
    password='IJoFJbT8Qj0Q0w5m'
)
cur = conn.cursor()

try:
    print("Associating PP 1 to IC 1...")
    cur.execute("UPDATE pedido_proveedor SET id_intencion_compra = 1 WHERE id = 1")
    conn.commit()

    print("Querying v_stock_rimec for PP 1 SKUs...")
    cur.execute("""
        SELECT det_id, descp_marca, linea_codigo, lpn, lpc02, lpc03, lpc04, cajas_disponibles
        FROM public.v_stock_rimec
        WHERE pp_id = 1
        LIMIT 5
    """)
    rows = cur.fetchall()
    for row in rows:
        print(f"det_id: {row[0]}, Marca: {row[1]}, Linea: {row[2]}, LPN: {row[3]}, LPC02: {row[4]}, LPC03: {row[5]}, LPC04: {row[6]}, Cajas: {row[7]}")

finally:
    print("Restoring PP 1 association to NULL...")
    cur.execute("UPDATE pedido_proveedor SET id_intencion_compra = NULL WHERE id = 1")
    conn.commit()
    conn.close()
