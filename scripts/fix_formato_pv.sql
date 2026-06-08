-- FIX: Corregir formato de nro_factura incorrecto
-- PROBLEMA: Facturas con formato "10-PV003" en lugar de "1-PV003" o "PV000003"

-- PASO 1: BACKUP (ejecutar primero)
CREATE TABLE IF NOT EXISTS factura_interna_backup_2026_06_08 AS
SELECT * FROM factura_interna
WHERE nro_factura ~ '^[0-9]+-PV[0-9]+$';

-- PASO 2: Ver qué se va a cambiar (DRY RUN)
SELECT
  id,
  nro_factura as antes,
  REGEXP_REPLACE(nro_factura, '^10-PV', '1-PV') as despues_opcion1,
  'PV' || LPAD(REGEXP_REPLACE(nro_factura, '^[0-9]+-PV', ''), 6, '0') as despues_opcion2
FROM factura_interna
WHERE nro_factura ~ '^10-PV[0-9]+$'
LIMIT 10;

-- OPCIÓN A: Corregir "10-PV" → "1-PV" (si el 10 es un error de tipeo)
-- UPDATE factura_interna
-- SET nro_factura = REGEXP_REPLACE(nro_factura, '^10-PV', '1-PV')
-- WHERE nro_factura ~ '^10-PV[0-9]+$';

-- OPCIÓN B: Corregir a formato estándar "PVXXXXXX"
-- UPDATE factura_interna
-- SET nro_factura = 'PV' || LPAD(REGEXP_REPLACE(nro_factura, '^[0-9]+-PV', ''), 6, '0')
-- WHERE nro_factura ~ '^[0-9]+-PV[0-9]+$';

-- PASO 3: Verificar resultado
-- SELECT
--   nro_factura,
--   pv_global,
--   COUNT(*) as cantidad
-- FROM factura_interna
-- WHERE nro_factura LIKE '%PV%'
-- GROUP BY nro_factura, pv_global
-- ORDER BY nro_factura;

-- NOTA: NO EJECUTAR UPDATE sin verificar primero con Héctor
-- Estos son queries de diagnóstico y fix propuesto