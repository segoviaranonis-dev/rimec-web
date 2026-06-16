# CHUSAR — Etapa RIMEC WEB (mudanza Streamlit)

**Dominio:** 3.2 venta / preventa / costos tránsito  
**Etapa madre:** `.claude/4_etapas/ETAPA_ABIERTA_RIMEC_WEB.md`  
**Estado etapa:** ACTIVA (desde 2026-06-16)

---

## Resumen una línea

Mudar lógica Nexus Streamlit → `rimec-web` / `report`; **primera sub-etapa:** costos de mercadería en tránsito.

---

## Bitácora

| Fecha | Evento |
|-------|--------|
| 2026-06-16 | Etapa **RIMEC WEB** abierta. Sub-etapa **001 costos tránsito** activa. |

---

## Sub-etapas (registro)

| ID | Tema | Estado | Notas |
|----|------|--------|-------|
| 001 | Costos en tránsito | ACTIVA | Ver `SUBETAPA_RIMEC_WEB_001_COSTOS_TRANSITO.md` |

**Al abrir sub-etapa N+1:** crear `SUBETAPA_RIMEC_WEB_NNN_<TEMA>.md`, fila en etapa madre, fila aquí.

---

## Referencias código (rimec-web hoy)

| Área | Ruta | Nota |
|------|------|------|
| PP en tránsito | `lib/controlStock/fetchControl.ts` | `estado_transito = EN_TRANSITO` |
| Estadísticas | `app/api/estadisticas/`, `lib/controlStock/` | Árbol PP; sin costo aún |
| Catálogo preventa | `lib/catalogoData.ts`, motor casos vía PP | Precio venta, no costo |
| Legacy Nexus | `control_central/core/precio_evento_caso.py` | Fuente paridad (monorepo) |

---

## Anti-patrones

1. Calcular costo en `.tsx` o con anon key expuesta.
2. Usar `linea.caso_id` en lugar de motor + evento + PP.
3. Abrir sub-etapas sin cerrar la anterior (salvo paralelo explícito del Director).
4. Confundir esta etapa con **Bazzar Web Publicación MVP** (paralela, distinta).

---

**Índice etapas abiertas:** `.claude/4_etapas/ETAPAS_ABIERTAS.md`
