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
    print("=== CASO PRECIO BIBLIOTECA ===")
    cur.execute("SELECT id, nombre_caso FROM caso_precio_biblioteca")
    casos = cur.fetchall()
    for c in casos:
        print(f"ID: {c[0]}, Nombre: {c[1]}")

    print("\n=== PRECIO LISTA (caso_id únicos) ===")
    cur.execute("SELECT DISTINCT caso_id FROM precio_lista")
    pl_casos = cur.fetchall()
    for pc in pl_casos:
        print(f"precio_lista.caso_id: {pc[0]}")

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
