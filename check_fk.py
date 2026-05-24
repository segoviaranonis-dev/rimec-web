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
    # Obtener información del foreign key
    cur.execute("""
        SELECT
            kcu.table_name AS foreign_table,
            kcu.column_name AS foreign_column,
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
          AND tc.constraint_name = 'factura_interna_caso_id_fkey'
    """)
    fk = cur.fetchone()
    print("FK Info:", fk)

    if fk:
        ref_table = fk[2]
        ref_col = fk[3]
        print(f"\nConsultando tabla referenciada: {ref_table}...")
        cur.execute(f"SELECT {ref_col}, * FROM {ref_table} LIMIT 10")
        rows = cur.fetchall()
        for r in rows:
            print(r)

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
