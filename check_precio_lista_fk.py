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
    # Obtener FK de precio_lista
    cur.execute("""
        SELECT
            kcu.column_name AS local_column,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'precio_lista'
    """)
    fks = cur.fetchall()
    print("FKs of precio_lista:")
    for fk in fks:
        print(f"Columna: {fk[0]} -> Tabla: {fk[1]}({fk[2]})")

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
