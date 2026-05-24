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
    print("=== PRECIO EVENTO CASO ===")
    cur.execute("SELECT * FROM precio_evento_caso LIMIT 20")
    # print column names first
    colnames = [desc[0] for desc in cur.description]
    print("Columns:", colnames)
    rows = cur.fetchall()
    for r in rows:
        print(r)

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
