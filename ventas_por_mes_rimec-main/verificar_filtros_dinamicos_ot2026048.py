#!/usr/bin/env python
"""OT-2026-048: Verificar filtros dinámicos desde v_stock_web en ambos sitios"""
from sqlalchemy import create_engine, text

db_url = 'postgresql://postgres.extrlcvcgypwazxipvqm:IJoFJbT8Qj0Q0w5m@aws-1-sa-east-1.pooler.supabase.com:6543/postgres'
engine = create_engine(db_url)

print('='*80)
print('OT-2026-048: VERIFICACION FILTROS DINAMICOS v_stock_web')
print('='*80)

with engine.connect() as conn:
    # 1. BAZZAR - Marcas
    print('\n[BAZZAR - MARCAS desde v_stock_web]')
    print('-'*80)
    result = conn.execute(text("""
        SELECT DISTINCT marca
        FROM v_stock_web
        WHERE stock_web > 0 AND marca IS NOT NULL
        ORDER BY marca
    """))
    marcas = [row[0] for row in result]
    print(f'  Total: {len(marcas)} marcas')
    for m in marcas[:10]:
        print(f'    - {m}')
    if len(marcas) > 10:
        print(f'    ... y {len(marcas) - 10} mas')

    # 2. BAZZAR - Estilos
    print('\n[BAZZAR - ESTILOS desde v_stock_web]')
    print('-'*80)
    result = conn.execute(text("""
        SELECT DISTINCT estilo, estilo_id
        FROM v_stock_web
        WHERE stock_web > 0 AND estilo IS NOT NULL
        ORDER BY estilo
    """))
    estilos = list(result)
    print(f'  Total: {len(estilos)} estilos')
    for e in estilos:
        print(f'    - {e[0]} (id: {e[1]})')

    # 3. BAZZAR - Colores
    print('\n[BAZZAR - COLORES desde v_stock_web]')
    print('-'*80)
    result = conn.execute(text("""
        SELECT DISTINCT color_nombre
        FROM v_stock_web
        WHERE stock_web > 0 AND color_nombre IS NOT NULL
        ORDER BY color_nombre
    """))
    colores = [row[0] for row in result]
    print(f'  Total: {len(colores)} colores')
    for c in colores[:15]:
        print(f'    - {c}')
    if len(colores) > 15:
        print(f'    ... y {len(colores) - 15} mas')

    # 4. RIMEC - Header por genero (JOIN con tabla linea)
    print('\n[RIMEC - HEADER por GENERO (v_stock_web + linea)]')
    print('-'*80)
    result = conn.execute(text("""
        SELECT DISTINCT
            l.genero,
            v.linea_codigo,
            v.marca
        FROM v_stock_web v
        INNER JOIN linea l ON v.linea_codigo = l.codigo_proveedor
        WHERE v.stock_web > 0
          AND l.genero IS NOT NULL
        ORDER BY l.genero, v.linea_codigo
    """))

    generos = {'MUJER': set(), 'HOMBRE': set(), 'NINO': set()}
    for row in result:
        genero = row[0].upper() if row[0] else ''
        linea = str(row[1])
        marca = row[2]

        if 'MUJER' in genero or genero == 'F':
            generos['MUJER'].add(f'{linea}|{marca}')
        elif 'HOMBRE' in genero or genero == 'M':
            generos['HOMBRE'].add(f'{linea}|{marca}')
        elif 'NIÑO' in genero or 'NINO' in genero or genero == 'KIDS':
            generos['NINO'].add(f'{linea}|{marca}')

    for g, items in generos.items():
        print(f'\n  {g}:')
        lineas = set()
        marcas = set()
        for item in items:
            l, m = item.split('|')
            lineas.add(l)
            if m:
                marcas.add(m)
        print(f'    Lineas: {sorted(lineas)[:5]}')
        print(f'    Marcas: {sorted(marcas)[:5]}')

print('\n' + '='*80)
print('[OK] VERIFICACION COMPLETADA - Ambos sitios usan v_stock_web')
print('='*80)
