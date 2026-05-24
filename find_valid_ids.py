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
    # 1. Obtener un cliente mayorista
    cur.execute("SELECT id_cliente, descp_cliente FROM cliente_v2 WHERE tipo = 'MAYORISTA' LIMIT 1")
    cliente = cur.fetchone()
    print("Cliente mayorista encontrado:", cliente)

    # 2. Obtener roles disponibles
    cur.execute("SELECT id, nombre_rol, descripcion FROM maestro_rol_acceso")
    roles = cur.fetchall()
    print("\nRoles maestros de acceso:")
    for r in roles:
        print(f" ID: {r[0]}, Nombre: {r[1]}, Desc: {r[2]}")

    # 3. Obtener un usuario vendedor
    cur.execute("""
        SELECT u.id_usuario, u.descp_usuario, r.nombre_rol
        FROM usuario_v2 u
        JOIN maestro_rol_acceso r ON r.id = u.rol_id
        WHERE r.nombre_rol IN ('VENDEDOR', 'ADMIN')
        LIMIT 5
    """)
    usuarios = cur.fetchall()
    print("\nUsuarios vendedores o administradores:")
    for u in usuarios:
        print(f" ID: {u[0]}, Nombre: {u[1]}, Rol: {u[2]}")

    # 4. Obtener plazos
    cur.execute("SELECT id_plazo, descp_plazo FROM plazo_v2 LIMIT 1")
    plazo = cur.fetchone()
    print("\nPlazo de pago encontrado:", plazo)

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
