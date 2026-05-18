#!/usr/bin/env python
"""Verificar datos de genero en tabla linea"""
from sqlalchemy import create_engine, text

db_url = 'postgresql://postgres.extrlcvcgypwazxipvqm:IJoFJbT8Qj0Q0w5m@aws-1-sa-east-1.pooler.supabase.com:6543/postgres'
engine = create_engine(db_url)

with engine.connect() as conn:
    # Ver sample de lineas con y sin genero
    result = conn.execute(text('''
        SELECT codigo_proveedor, descripcion, genero,
               (SELECT COUNT(*) FROM v_stock_web WHERE linea_codigo = linea.codigo_proveedor AND stock_web > 0) as stock_count
        FROM linea
        ORDER BY codigo_proveedor
        LIMIT 20
    '''))
    print('Sample lineas (con stock en v_stock_web):')
    print('-'*80)
    for row in result:
        g = row[2] if row[2] else 'NULL'
        print(f'{row[0]:8} | {row[1] if row[1] else "NULL":30} | genero: {g:10} | stock: {row[3]}')

    # Contar lineas con genero
    result2 = conn.execute(text('SELECT COUNT(*) FROM linea WHERE genero IS NOT NULL')).scalar()
    result3 = conn.execute(text('SELECT COUNT(*) FROM linea')).scalar()
    print(f'\nTotal lineas: {result3}')
    print(f'Lineas con genero: {result2}')
    print(f'Lineas sin genero: {result3 - result2}')
