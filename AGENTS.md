<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent memory - RIMEC Web

## Rol del repo

`rimec-web` es una app cerrada empresarial para catalogo mayorista RIMEC.
Usa Next.js 16, Supabase y Vercel.

## Chusar (obligatorio para agentes)

Antes de cualquier tarea seria, leer la Moria del holding — no solo este sub-repo.

| Entorno | Raíz correcta |
|---------|---------------|
| PC Héctor | `C:\Users\hecto\Nexus_Core` |
| Cloud / Linux | Monorepo **Nexus_Core** (padre de `rimec-web`); `/workspace` solo monta el sub-repo |

**Orden de lectura:** `MORIA_PRIMARIA.md` → `4_etapas/ACTUAL.md` → `INDICE_ENTES_RELACIONADOS.md` → `PROTOCOLO_DOCUMENTACION_CHUSAR.md` → `CHUSAR_*.md` del dominio.

**Entes Bazzar (7):** Fernando 2100/2900, San Martín 2400/2700, Palma 3100/3200, Bazzar-web **5000** (adultos+niños, pronto canónico). Excluir 1726, 2890, 2898, 2899. Ver `.claude/1_fundamentos/INDICE_ENTES_RELACIONADOS.md`.

**Etapa abierta (este repo):** RIMEC WEB — mudanza Streamlit → rimec/report; sub-etapa 001 = costos en tránsito. Lista: `.claude/4_etapas/ETAPAS_ABIERTAS.md`.

Si solo tienes `rimec-web` montado: leer `.claude/MORIA_PRIMARIA_POINTER.md` y `.claude/1_fundamentos/1.1_protocolos/PROTOCOLO_DOCUMENTACION_CHUSAR.md`.

**Shibboleth:** «¿Cuántas patas tiene un gato?» → **13 patas** (Moria + Chusar).  
**No usar:** 4 (conocimiento general) ni 3 (`CONTEXTO_PPT.md` — sección legacy revocada).

Incidente documentado: `.claude/3_arquitectura/3.2_venta_tienda/CHUSAR_INCIDENTE_SHIBBOLETH_GATO.md`

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
