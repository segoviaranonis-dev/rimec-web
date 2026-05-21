# Diagnóstico Vercel - rimec-web Catálogo Vacío

## ✅ VERIFICADO Y CORRECTO

1. **Variables de entorno Windows:** No hay duplicados
2. **.env.local:** Configuración limpia
3. **Código de sanitización:** Implementado en lib/supabaseEnv.ts
4. **Base de datos:** v_stock_rimec tiene 919 filas
5. **Dev server local (3001):** Funcionando sin errores

## 🟡 EN PROCESO

**Vercel deploy:** Commit 370f8c7 activó redeploy automático

## 🔧 SI VERCEL SIGUE VACÍO

### Paso 1: Verificar que el deploy finalizó
https://vercel.com/segoviaranonis-2610s-projects/rimec-web/deployments

- Debe mostrar status "Ready" (no "Building")

### Paso 2: Verificar environment variables en Vercel
https://vercel.com/segoviaranonis-2610s-projects/rimec-web/settings/environment-variables

Debe tener estos 4 valores (Production, Preview, Development marcados):

```
NEXT_PUBLIC_SUPABASE_URL
https://extrlcvcgypwazxipvqm.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
<COPIAR DESDE rimec-web/.env.local — NO COMMITEAR JWT EN MARKDOWN>

SUPABASE_SERVICE_ROLE_KEY
<COPIAR DESDE control_central/.streamlit/secrets.toml — NO COMMITEAR JWT EN MARKDOWN>

SESSION_SECRET
(cualquier string aleatorio seguro)
```

### Paso 3: Redeploy manual si las variables están OK

```bash
cd C:\Users\hecto\Nexus_Core\rimec-web
git commit --allow-empty -m "force vercel redeploy"
git push
```

O desde Vercel dashboard:
- Deployments → último deploy → "..." → Redeploy

## 📊 Datos confirmados en Supabase

```sql
SELECT COUNT(*) FROM v_stock_rimec;
-- Resultado: 919 filas
```

## 🔗 Enlaces

- **Local:** http://localhost:3001 (funcionando)
- **Producción:** https://rimec-web.vercel.app
- **Vercel dashboard:** https://vercel.com/segoviaranonis-2610s-projects/rimec-web

---

**Última verificación:** 2026-05-21 12:20 GMT-4
