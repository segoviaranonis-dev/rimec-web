# MIGRACIÓN: Eliminar "FI" → Usar solo "PV"

**Fecha**: 2026-06-08  
**Decreto**: "PV y FI son la misma cosa y todos deben regirse al serial de PV, el termino FI vamos a descartarlo"

---

## 🎯 OBJETIVO

**Serie única cronológica**:
- Primera confirmación → **PV000001**
- Segunda confirmación → **PV000002**
- Tercera confirmación → **PV000003**
- Y así sucesivamente...

**Eliminar**: Todos los términos "FI", "Factura Interna", `nro_factura` legacy

**Usar**: Solo "PV", "Preventa", `pv_global`

---

## ✅ LO QUE YA FUNCIONA

**Migración 107** ya implementa:
- ✅ Campo `pv_global` en BD
- ✅ Trigger auto-incrementa al CONFIRMAR
- ✅ Secuencia cronológica correcta

**El problema**: El código NO lo usa correctamente.

---

## 🔧 ARCHIVOS A MODIFICAR

### **1. rimec-web/app/mis-facturas/page.tsx**

```typescript
// ANTES:
function fmtPV(fi: FacturaInterna): string {
  if (fi.pv_global) {
    return `PV${fi.pv_global.toString().padStart(6, '0')}`
  }
  return fi.nro_factura  // ← INCORRECTO: usa legacy
}

// DESPUÉS:
function fmtPV(pv: { pv_global: number | null }): string {
  if (!pv.pv_global) {
    return 'SIN NÚMERO'  // No debería pasar si está confirmada
  }
  return `PV${pv.pv_global.toString().padStart(6, '0')}`
}
```

**Cambios**:
- ❌ Eliminar uso de `nro_factura`
- ✅ Solo usar `pv_global`
- ✅ Siempre formatear como PV000001

---

### **2. rimec-web/app/pedidos/page.tsx**

```typescript
// ANTES: (línea 97-106)
function fmtPV(fi: FacturaInternaRow): string {
  if (fi.numero_preventa_global) {
    return fi.numero_preventa_global
  }
  if (fi.pv_global) {
    return `PV${fi.pv_global.toString().padStart(6, '0')}`
  }
  return fi.nro_factura
}

// DESPUÉS:
function fmtPV(fi: { pv_global: number | null }): string {
  if (!fi.pv_global) {
    return 'PENDIENTE'  // Aún no confirmada
  }
  return `PV${fi.pv_global.toString().padStart(6, '0')}`
}
```

---

### **3. rimec-web/app/api/mis-facturas/route.ts**

```typescript
// ANTES: (línea 29-32)
.select(`
  id,
  nro_factura,  // ← ELIMINAR
  pv_global,
  ...
`)

// DESPUÉS:
.select(`
  id,
  pv_global,  // ← SOLO ESTO
  ...
`)
```

**Eliminar**:
- ❌ `nro_factura` del SELECT
- ❌ `numero_preventa_global` si existe

---

### **4. rimec-web/app/api/pdf/factura/[id]/route.ts**

```typescript
// ANTES: (línea 101)
.select('id, vendedor_id, estado, nro_factura')

// DESPUÉS:
.select('id, vendedor_id, estado, pv_global')
```

```typescript
// ANTES: (línea 354)
if (!fiCompleta.nro_factura) {
  console.error('[PDF] Falta nro_factura')
  ...
}

// DESPUÉS:
if (!fiCompleta.pv_global) {
  console.error('[PDF] Falta pv_global')
  return NextResponse.json(
    { error: 'Preventa sin número asignado' },
    { status: 400 }
  )
}
```

```typescript
// ANTES: (línea 380)
nro_factura: fiCompleta.nro_factura,

// DESPUÉS:
pv_numero: `PV${fiCompleta.pv_global.toString().padStart(6, '0')}`,
```

```typescript
// ANTES: (línea 425)
filename="FI_${fi.nro_factura}.pdf"

// DESPUÉS:
filename="PV${fiCompleta.pv_global.toString().padStart(6, '0')}.pdf"
```

---

### **5. rimec-web/lib/pdfGenerator.ts**

```typescript
// BUSCAR Y REEMPLAZAR en todo el archivo:

// ANTES:
interface FIData {
  id_factura: number
  nro_factura: string
  ...
}

// DESPUÉS:
interface PVData {
  id: number
  pv_numero: string  // Ya formateado como "PV000001"
  ...
}
```

```typescript
// ANTES:
function generarPDFFactura(fiData: FIData) {
  const nroFactura = fiData.nro_factura
  ...
}

// DESPUÉS:
function generarPDFPreventa(pvData: PVData) {
  const pvNumero = pvData.pv_numero
  ...
}
```

**En el PDF**:
- Header: "PREVENTA RIMEC" (no "Factura Interna")
- Número: "PV000045" (no "10-PV045")

---

### **6. rimec-web/app/api/pedidos/route.ts**

```typescript
// ANTES: (línea 60)
.select('id, numero_preventa_global, pv_global, nro_factura, ...')

// DESPUÉS:
.select('id, pv_global, ...')
```

**Eliminar**:
- ❌ `numero_preventa_global`
- ❌ `nro_factura`

---

## 📊 INTERFAZ TypeScript A ACTUALIZAR

### **ANTES:**
```typescript
interface FacturaInterna {
  id: number
  nro_factura: string  // ← ELIMINAR
  pv_global: number | null
  numero_preventa_global?: string | null  // ← ELIMINAR
  ...
}
```

### **DESPUÉS:**
```typescript
interface Preventa {
  id: number
  pv_global: number  // Siempre presente si CONFIRMADA
  ...
}

// Helper para formatear
function formatPV(pvGlobal: number): string {
  return `PV${pvGlobal.toString().padStart(6, '0')}`
}
```

---

## 🗄️ BASE DE DATOS (SQL)

### **Limpieza de datos legacy:**

```sql
-- 1. Verificar que todas las FIs CONFIRMADAS tienen pv_global
SELECT COUNT(*) as sin_pv_global
FROM factura_interna
WHERE estado = 'CONFIRMADA'
  AND pv_global IS NULL;

-- Si hay registros sin pv_global, asignarles número:
UPDATE factura_interna
SET pv_global = (
  SELECT COALESCE(MAX(pv_global), 0) + ROW_NUMBER() OVER (ORDER BY created_at)
  FROM factura_interna fi2
  WHERE fi2.pv_global IS NOT NULL
)
WHERE estado IN ('CONFIRMADA', 'ANULADA')
  AND pv_global IS NULL;

-- 2. (OPCIONAL) Actualizar nro_factura legacy para consistencia
-- Solo si quieres que nro_factura también tenga el formato correcto
UPDATE factura_interna
SET nro_factura = 'PV' || LPAD(pv_global::TEXT, 6, '0')
WHERE pv_global IS NOT NULL;
```

---

## ✅ CHECKLIST DE MIGRACIÓN

### **Fase 1: Verificación (30 min)**
- [ ] Ejecutar `verificar_pv_global.sql`
- [ ] Confirmar que migración 107 está aplicada
- [ ] Verificar que todas las FIs CONFIRMADAS tienen `pv_global`
- [ ] Listar FIs con formato legacy incorrecto

### **Fase 2: Código Backend (1 hora)**
- [ ] Actualizar `/api/mis-facturas/route.ts`
- [ ] Actualizar `/api/pedidos/route.ts`
- [ ] Actualizar `/api/pdf/factura/[id]/route.ts`
- [ ] Actualizar `lib/pdfGenerator.ts`

### **Fase 3: Código Frontend (1 hora)**
- [ ] Actualizar `app/mis-facturas/page.tsx`
- [ ] Actualizar `app/pedidos/page.tsx`
- [ ] Buscar y reemplazar "Factura Interna" → "Preventa"
- [ ] Buscar y reemplazar "FI" → "PV"
- [ ] Actualizar interfaces TypeScript

### **Fase 4: Testing (30 min)**
- [ ] Confirmar pedido nuevo
- [ ] Verificar que se asigna PV000XXX correctamente
- [ ] Generar PDF
- [ ] Verificar formato "PV000XXX" en PDF
- [ ] Verificar lista "Mis Facturas" muestra PV000XXX

### **Fase 5: Deploy (15 min)**
- [ ] Commit changes
- [ ] Push a GitHub
- [ ] Vercel deploy automático
- [ ] Validar en producción

---

## 🚨 RIESGOS Y MITIGACIONES

### **Riesgo 1: FIs viejas sin pv_global**
**Mitigación**: SQL UPDATE para asignarles número cronológico

### **Riesgo 2: Breaking change en APIs**
**Mitigación**: Apps que consumen la API deben actualizar también

### **Riesgo 3: PDFs legacy con nro_factura**
**Mitigación**: PDFs ya generados quedan con formato viejo (aceptable)

---

## 📝 NOMENCLATURA DEFINITIVA

| Término | Estado | Uso |
|---------|--------|-----|
| **PV** | ✅ USAR | Único término oficial |
| **Preventa** | ✅ USAR | Nombre completo |
| **pv_global** | ✅ USAR | Campo en BD |
| **FI** | ❌ ELIMINAR | Deprecated |
| **Factura Interna** | ❌ ELIMINAR | Deprecated |
| **nro_factura** | ❌ ELIMINAR | Legacy, no usar |
| **numero_preventa_global** | ❌ ELIMINAR | Redundante |

---

## 🎯 RESULTADO FINAL

**ANTES** (INCORRECTO):
- UI: "10-PV003"
- BD: `nro_factura = "10-PV003"`, `pv_global = 3`
- PDF: "Factura Interna 10-PV003"

**DESPUÉS** (CORRECTO):
- UI: "PV000003"
- BD: `pv_global = 3`
- PDF: "Preventa RIMEC PV000003"

---

**Tiempo Estimado Total**: 3 horas  
**Criticidad**: ALTA - afecta presentación al cliente  
**Dependencias**: Migración 107 debe estar aplicada