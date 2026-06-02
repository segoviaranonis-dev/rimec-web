<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent memory - RIMEC Web

## Rol del repo

`rimec-web` es una app cerrada empresarial para catalogo mayorista RIMEC.
Usa Next.js 16, Supabase y Vercel.

## Leyes de trabajo

- GitHub es la verdad central; la PC de Hector es taller; Vercel es vidriera.
- RIMEC Web es app cerrada: login, roles, APIs protegidas y logout visible.
- No hacer publica una ruta interna sin autorizacion explicita.
- No confiar en el navegador para precio, stock, carrito, factura o PDF.
- Este repo usa `proxy.ts` para proteger rutas en Next 16.
- Sesion: cookie `rimec_session` firmada con `SESSION_SECRET`.
- Datos sensibles usan servidor y `SUPABASE_SERVICE_ROLE_KEY`; nunca exponer service role al navegador.

## Reglas de catalogo RIMEC

- Estilo y Tipo 1 vienen de `linea_referencia`, no de `linea.caso_id`.
- Enriquecer filas con `lib/atributosLinea.ts` antes de armar filtros.
- `v_stock_rimec` debe respetar una fila por detalle/origen real.
- Las tarjetas multi-origen se agrupan por `sku_id + origen_tipo + origen_referencia_id`.
- Solo mostrar stock con cajas disponibles.

## Prioridad actual

No tocar Bazzar desde este repo.
Si se trabaja auth, alinear con app cerrada:
- login obligatorio
- rutas internas protegidas
- APIs protegidas
- logout visible
- cookies viejas invalidadas si cambia el contrato

Antes de tocar codigo:
1. `git status`
2. revisar `README.md`
3. revisar `proxy.ts`
4. leer docs de Next 16 si se toca routing/proxy

Validacion minima:
- `npm run build`
- probar UI si toca `.tsx`
- probar ruta sin sesion y con rol correcto
