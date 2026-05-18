"""Consulta linea+referencia (códigos proveedor) vs pilar y vista web."""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / ".." / "ventas_por_mes_rimec-main"))

from core.database import get_dataframe

PARES = [(1214, 1073), (1214, 1075), (1388, 500)]

sql_pilar = """
SELECT
  l.codigo_proveedor::text AS linea_codigo,
  r.codigo_proveedor::text AS ref_codigo,
  l.id AS linea_id,
  r.id AS referencia_id,
  lr.id AS lr_id,
  lr.grupo_estilo_id,
  COALESCE(lr.descp_grupo_estilo, ge.descp_grupo_estilo) AS estilo,
  lr.tipo_1_id,
  COALESCE(lr.descp_tipo_1, t1.descp_tipo_1) AS tipo_1,
  l.grupo_estilo_id AS linea_grupo_estilo_id
FROM linea l
JOIN referencia r ON r.linea_id = l.id
LEFT JOIN linea_referencia lr
  ON lr.linea_id = l.id AND lr.referencia_id = r.id
LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
WHERE (l.codigo_proveedor::text, r.codigo_proveedor::text) IN (
  ('1214','1073'), ('1214','1075'), ('1388','500')
)
ORDER BY 1, 2;
"""

sql_vista = """
SELECT DISTINCT
  linea_codigo, referencia_codigo,
  linea_id, referencia_id,
  grupo_estilo_id, descp_grupo_estilo,
  tipo_1_id, descp_tipo_1
FROM v_stock_rimec
WHERE (linea_codigo, referencia_codigo) IN (
  ('1214','1073'), ('1214','1075'), ('1388','500')
)
ORDER BY 1, 2;
"""

sql_lr_cast_bug = """
SELECT
  lr.linea_id, lr.referencia_id,
  lr.grupo_estilo_id,
  COALESCE(lr.descp_grupo_estilo, ge.descp_grupo_estilo) AS estilo,
  lr.tipo_1_id,
  COALESCE(lr.descp_tipo_1, t1.descp_tipo_1) AS tipo_1
FROM linea_referencia lr
LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
WHERE (lr.linea_id, lr.referencia_id) IN ((1214, 1073), (1214, 1075), (1388, 500));
"""

print("=== PILAR (linea.id + referencia.id) ===\n")
print(get_dataframe(sql_pilar).to_string(index=False))

print("\n=== VISTA v_stock_rimec ===\n")
print(get_dataframe(sql_vista).to_string(index=False))

print("\n=== linea_referencia WHERE linea_id=1214 (join erróneo vista) ===\n")
print(get_dataframe(sql_lr_cast_bug).to_string(index=False))
