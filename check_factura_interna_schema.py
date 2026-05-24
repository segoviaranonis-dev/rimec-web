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
    print("=== FACTURA INTERNA SCHEMA ===")
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'factura_interna'
    """)
    rows = cur.fetchall()
    for r in rows:
        print(f"Col: {r[0]} | Type: {r[1]} | Nullable: {r[2]}")

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
