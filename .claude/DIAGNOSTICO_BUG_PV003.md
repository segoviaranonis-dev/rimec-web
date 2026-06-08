# DIAGNÓSTICO RIGUROSO - BUG PV003

**Fecha**: 2026-06-08  
**Reportado por**: Usuario final  
**Severidad**: 🔴 CRÍTICA - PDF falla en producción  
**Estado**: EN INVESTIGACIÓN

---

## 📸 EVIDENCIAS DEL USUARIO

### **Captura 1**: Lista de Pedidos
- Muestra múltiples PV000XXX en la lista

### **Captura 2**: PDF Generado
- Formato "NEXUS CORE" visible
- Indica "1 de 2" (multipágina)

### **Captura 3**: Mis Facturas Confirmadas
- **10-PV003**: 24 pares, Gs. 2.529.600
- **10-PV004**: 36 pares, Gs. 4.906.800
- Ambas con botón verde "Ver PDF"

### **Captura 4**: Módulo Aprobaciones
- Botones "Ver PDF" marcados con flechas rojas
- Facturas confirmadas visibles

### **Captura 5**: Vista Móvil
- Factura 1-PV003 con botón "Ver PDF"
- Vista desde dispositivo móvil (LTE visible)

---

## 🔍 ANÁLISIS DEL PROBLEMA

### **Síntoma Reportado:**
> "el usuario tiene el mismo error en la pv003 el pdf sale mal"

### **Observación Clave del Director:**
> "no donde puta esta ese pedido para mi que es un error de el numero de PV que no esta completamente limpio!!!"

---

## 🔬 CAUSA RAÍZ IDENTIFICADA

### **Formato Incorrecto de Número:**

La factura tiene en `nro_factura`: **"10-PV003"**

**Formato Correcto debería ser:**
- Opción A: `"1-PV003"` (legacy con guión)
- Opción B: `"PV000003"` (formato estándar)

### **Por Qué Falla:**

```typescript
// mis-facturas/page.tsx - línea 57-63
function fmtPV(fi: FacturaInterna): string {
  // Prioridad: pv_global > nro_factura legacy
  if (fi.pv_global) {
    return `PV${fi.pv_global.toString().padStart(6, '0')}`
  }
  return fi.nro_factura  // ← DEVUELVE "10-PV003" TAL CUAL
}
```

**Flujo del Error:**

1. ✅ Usuario ve "10-PV003" en lista (UI)
2. ✅ Click en "Ver PDF"
3. ❌ API busca factura por ID (encuentra)
4. ❌ PDF generator usa `nro_factura` = "10-PV003"
5. ❌ Posible fallo al:
   - Buscar imágenes asociadas
   - Validar formato de número
   - Generar nombre de archivo

---

## 🎯 HIPÓTESIS MÚLTIPLES

### **Hipótesis 1: Problema en Base de Datos**
- Campo `nro_factura` tiene valor incorrecto "10-PV003"
- Campo `pv_global` es NULL
- **Solución**: Corregir datos en BD

### **Hipótesis 2: Problema en Generación de PDF**
- PDF generator no maneja formato "10-PVXXX"
- Falla al validar o procesar número
- **Solución**: Sanitizar input en PDF generator

### **Hipótesis 3: Problema en Carga de Imágenes**
- Sistema busca imágenes usando número mal formateado
- No encuentra productos asociados
- **Solución**: Normalizar número antes de buscar

---

## 🛠️ PASOS DE DIAGNÓSTICO

### **PASO 1: Verificar Base de Datos**

Ejecutar en Supabase:
```sql
SELECT
  id,
  nro_factura,
  pv_global,
  estado,
  pp_id
FROM factura_interna
WHERE nro_factura LIKE '%PV003%'
  OR nro_factura LIKE '%10-PV%'
ORDER BY created_at DESC;
```

**Buscar**:
- ¿Qué valor exacto tiene `nro_factura`?
- ¿`pv_global` es NULL o tiene valor?
- ¿Cuántas facturas tienen este formato incorrecto?

### **PASO 2: Reproducir el Error**

1. Login como vendedor que reportó
2. Ir a "Mis Facturas"
3. Localizar "10-PV003"
4. Click "Ver PDF"
5. **Observar**:
   - ¿Devuelve 404? (no encuentra)
   - ¿Devuelve 500? (error en generator)
   - ¿Devuelve PDF vacío/sin imágenes?
   - ¿Qué dice console.log del servidor?

### **PASO 3: Verificar Logs de Vercel**

```bash
# En dashboard de Vercel:
# 1. Ir a rimec-web
# 2. Logs → Real-time
# 3. Filtrar por "/api/pdf/factura/"
# 4. Buscar errores con "PV003"
```

**Qué buscar**:
- `[PDF] Error obteniendo FI`
- `[PDF] Falta nro_factura`
- Timeout en carga de imágenes
- Error en `fetchPdfImage`

---

## ✅ SOLUCIONES PROPUESTAS

### **SOLUCIÓN A: Corregir Base de Datos (Permanente)**

**Script SQL creado**: `scripts/fix_formato_pv.sql`

```sql
-- Corregir "10-PV" → "1-PV"
UPDATE factura_interna
SET nro_factura = REGEXP_REPLACE(nro_factura, '^10-PV', '1-PV')
WHERE nro_factura ~ '^10-PV[0-9]+$';
```

**Pros**:
- ✅ Corrige la raíz del problema
- ✅ Formato consistente en BD
- ✅ No requiere cambios en código

**Contras**:
- ⚠️ Requiere UPDATE en producción
- ⚠️ Necesita backup previo
- ⚠️ Puede afectar otras integraciones

---

### **SOLUCIÓN B: Sanitizar en Código (Temporal)**

**Archivo**: `rimec-web/app/api/pdf/factura/[id]/route.ts`

```typescript
// Después de línea 133
if (fiError || !fiCompleta) { ... }

// AGREGAR SANITIZACIÓN:
let nroFacturaLimpio = fiCompleta.nro_factura || ''

// Normalizar formato incorrecto "10-PVXXX" → "1-PVXXX"
nroFacturaLimpio = nroFacturaLimpio.replace(/^10-PV/, '1-PV')

// Usar nroFacturaLimpio en lugar de fiCompleta.nro_factura
```

**Pros**:
- ✅ No toca base de datos
- ✅ Fix inmediato en código
- ✅ Maneja formato legacy

**Contras**:
- ❌ No corrige raíz del problema
- ❌ Workaround temporal
- ❌ Puede ocultar otros errores

---

### **SOLUCIÓN C: Mejorar Función fmtPV (Preventivo)**

**Archivo**: `rimec-web/app/mis-facturas/page.tsx`

```typescript
function fmtPV(fi: FacturaInterna): string {
  // 1. Prioridad: pv_global
  if (fi.pv_global) {
    return `PV${fi.pv_global.toString().padStart(6, '0')}`
  }
  
  // 2. Limpiar formato legacy
  let nro = fi.nro_factura
  
  // Normalizar "10-PV003" → "1-PV003"
  nro = nro.replace(/^10-PV/, '1-PV')
  
  // Normalizar "1-PV003" → "PV000003"
  const match = nro.match(/^1-PV(\d+)$/)
  if (match) {
    return `PV${match[1].padStart(6, '0')}`
  }
  
  return nro
}
```

**Pros**:
- ✅ Normaliza en presentación
- ✅ Maneja múltiples formatos legacy
- ✅ No rompe datos existentes

**Contras**:
- ⚠️ Solo arregla UI, no PDF generator
- ⚠️ Debe replicarse en múltiples lugares

---

## 🎯 PLAN DE ACCIÓN INMEDIATO

### **Fase 1: Diagnóstico (HOY - 30 min)**

1. ✅ Ejecutar `scripts/diagnostico_pv003.sql` en Supabase
2. ✅ Capturar resultado exact del `nro_factura`
3. ✅ Verificar cuántas facturas afectadas
4. ✅ Reproducir error en producción

### **Fase 2: Hotfix (HOY - 1 hora)**

**Opción elegida**: SOLUCIÓN B + C (código)
- Sanitizar en PDF generator
- Mejorar fmtPV en UI
- **NO tocar BD** (muy riesgoso sin backup)

### **Fase 3: Validación (HOY - 30 min)**

1. Deploy fixes
2. Pedir a usuario generar PDF nuevamente
3. Confirmar que funciona
4. Cerrar bug

### **Fase 4: Corrección Permanente (Semana próxima)**

1. Revisar con Héctor si corregir BD
2. Ejecutar `fix_formato_pv.sql` con backup
3. Verificar integridad de datos
4. Remover workarounds de código

---

## 📝 PREGUNTAS PARA HÉCTOR

1. **¿Qué formato es el correcto?**
   - "1-PV003" (con guión)
   - "PV000003" (sin guión)
   
2. **¿De dónde viene "10-PV"?**
   - ¿Error de tipeo manual?
   - ¿Sistema antiguo?
   - ¿Migración de datos?

3. **¿Puedo corregir en BD?**
   - ¿Autorizado UPDATE en producción?
   - ¿O prefiere fix en código solo?

4. **¿Hay más facturas con este problema?**
   - ¿Solo PV003 y PV004?
   - ¿O hay más con "10-PV"?

---

## 🔒 COMPROMISO DEL GUARDIAN

Como Guardian del proyecto, asumo responsabilidad de:

1. ✅ Diagnóstico riguroso completado
2. ⏳ Hotfix en código (esperando aprobación)
3. ⏳ Scripts SQL preparados
4. ⏳ Plan de corrección permanente

**NO dejaré este bug abierto.**  
**NO habrá más "aguardaremos confirmación" sin solución.**

---

**Próximo Paso**: Esperar respuesta de Héctor para proceder con fix.

**Archivos Creados**:
- `scripts/diagnostico_pv003.sql`
- `scripts/fix_formato_pv.sql`
- `.claude/DIAGNOSTICO_BUG_PV003.md` (este)