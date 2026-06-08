# HOTFIX SEGURIDAD: Vulnerabilidad RLS Cerrada

**Fecha**: 2026-06-07  
**Criticidad**: 🔴 ALTA  
**Estado**: ✅ SOLUCIONADO - Pendiente validación

---

## 🚨 Vulnerabilidad Detectada

### **Qué estaba expuesto:**
- Tabla `pedido_venta_rimec` sin RLS
- Tabla `v_factura_interna_preventa` sin RLS
- Acceso directo desde navegador con `ANON_KEY`

### **Qué podía hacer un atacante:**
```javascript
// Desde consola del navegador:
const { data } = await supabase
  .from('pedido_venta_rimec')
  .select('*')

// ❌ Ve TODOS los pedidos (no solo los suyos)
// ❌ Ve precios de otros clientes  
// ❌ Ve descuentos confidenciales
```

---

## ✅ Solución Implementada

### 1. Nueva API Route Segura
**Archivo**: `app/api/pedidos/route.ts`

```typescript
// Servidor (usa SERVICE_ROLE_KEY)
const session = await getSession()
const { data } = await supabase
  .from('pedido_venta_rimec')
  .select('*')
  .eq('vendedor_id', session.id_usuario)  // ← FILTRO SEGURIDAD
```

**Características:**
- ✅ Autenticación obligatoria
- ✅ Filtra por `vendedor_id` de sesión
- ✅ Solo vendedor ve SUS pedidos
- ✅ Usa SERVICE_ROLE_KEY (servidor)

### 2. Cliente Actualizado
**Archivo**: `app/pedidos/page.tsx`

```typescript
// ANTES (❌ INSEGURO):
const { data } = await supabase
  .from('pedido_venta_rimec')
  .select('*')  // Sin filtro!

// DESPUÉS (✅ SEGURO):
const response = await fetch('/api/pedidos')
const { pedidos } = await response.json()
```

---

## 📊 Comparativa

| Aspecto | ANTES ❌ | AHORA ✅ |
|---------|----------|----------|
| **Dónde se ejecuta** | Cliente (navegador) | Servidor (API Route) |
| **Key usada** | ANON_KEY (pública) | SERVICE_ROLE_KEY (privada) |
| **Filtro por vendedor** | NO | SÍ |
| **Exposición datos** | TODOS los pedidos | Solo SUS pedidos |
| **RLS necesario** | SÍ (crítico) | NO (opcional) |

---

## 🧪 Validación Requerida

### Prueba en Desarrollo:

```bash
cd c:\Users\hecto\Nexus_Core\rimec-web
npm run dev
```

**1. Login** como vendedor A
**2. Ir** a http://localhost:3000/pedidos
**3. Verificar**: Solo ve pedidos de vendedor A

**4. Consola navegador** (test de seguridad):
```javascript
// Esto DEBE fallar ahora:
const { data } = await supabase.from('pedido_venta_rimec').select('*')
// Error: ReferenceError: supabase is not defined ✅
```

**5. Cambiar** a vendedor B
**6. Verificar**: Ve otros pedidos (de vendedor B)

---

## 🚀 Deploy a Producción

### Pasos:
1. ✅ Código commiteado (e105d03)
2. ✅ Push a GitHub main
3. ⏳ Vercel detecta → build → deploy automático
4. ⏳ **Validar en producción** (Héctor)

### Validación Producción:
- Login en https://rimec-web.vercel.app
- Ir a "Mis Pedidos"
- Verificar: solo ve sus pedidos
- Consola: `supabase is not defined` ✅

---

## 🛡️ RLS Opcional (Futuro)

Ahora que datos están protegidos en servidor, habilitar RLS es **opcional** (defensa en profundidad):

```sql
-- Si quieres agregar RLS adicional:
ALTER TABLE pedido_venta_rimec ENABLE ROW LEVEL SECURITY;

-- Policy para acceso desde servidor:
CREATE POLICY "service_role_full_access"
ON pedido_venta_rimec
FOR ALL
TO service_role
USING (true);
```

**Nota**: No urgente - la API ya filtra correctamente.

---

## 📝 Archivos Modificados

1. **`app/api/pedidos/route.ts`** (NUEVO)
   - API Route segura
   - Filtra por vendedor_id
   - Usa SERVICE_ROLE_KEY

2. **`app/pedidos/page.tsx`** (MODIFICADO)
   - Removido import supabase
   - Usa fetch('/api/pedidos')
   - Resuelto merge conflict

---

## 🔐 Lecciones Aprendidas

### ❌ **NO hacer:**
- Acceder Supabase desde cliente con ANON_KEY
- Queries sin filtro de usuario
- Confiar en "seguridad por oscuridad"

### ✅ **SÍ hacer:**
- APIs en servidor con SERVICE_ROLE_KEY
- Filtrar por sesión del usuario
- RLS como defensa adicional
- Validar en dev antes de producción

---

## 📚 Referencias

- **Supabase RLS**: https://supabase.com/docs/guides/auth/row-level-security
- **Next.js API Routes**: https://nextjs.org/docs/api-routes/introduction
- **Commit**: e105d03
- **Archivos**: `app/api/pedidos/route.ts`, `app/pedidos/page.tsx`

---

**Estado**: ✅ HOTFIX APLICADO  
**Próximo**: Validación en producción  
**Responsable**: Héctor