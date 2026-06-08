-- DIAGNÓSTICO: Verificar formato de nro_factura para facturas problemáticas
-- Buscar facturas con formato incorrecto "10-PV" o similar

-- 1. Ver las facturas con "10-PV" en el nombre
SELECT
  id,
  nro_factura,
  pv_global,
  estado,
  vendedor_id,
  created_at
FROM factura_interna
WHERE nro_factura LIKE '%10-PV%'
  OR nro_factura LIKE '%PV003%'
ORDER BY created_at DESC
LIMIT 20;

-- 2. Contar facturas con formato incorrecto
SELECT
  COUNT(*) as total_con_formato_incorrecto,
  COUNT(DISTINCT vendedor_id) as vendedores_afectados
FROM factura_interna
WHERE nro_factura ~ '^[0-9]+-PV[0-9]+$';  -- Formato: "10-PV003"

-- 3. Ver ejemplos de diferentes formatos
SELECT
  SUBSTRING(nro_factura, 1, 10) as formato_ejemplo,
  COUNT(*) as cantidad
FROM factura_interna
GROUP BY formato_ejemplo
ORDER BY cantidad DESC
LIMIT 15;

-- 4. Verificar si pv_global está null en las problemáticas
SELECT
  id,
  nro_factura,
  pv_global,
  CASE
    WHEN pv_global IS NULL THEN 'NULL - usa nro_factura'
    ELSE 'OK - usa pv_global'
  END as estado_numero
FROM factura_interna
WHERE nro_factura LIKE '%10-PV%'
  OR nro_factura LIKE '%PV003%';