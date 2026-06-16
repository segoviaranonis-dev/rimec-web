# ETAPA ABIERTA — RIMEC WEB · Mudanza Streamlit → rimec-web / report

**Estado:** 🚧 **ACTIVA**  
**Inicio:** 2026-06-16  
**Director:** Héctor  
**Repos:** `rimec-web`, `report`, origen Streamlit `control_central/` (Nexus_Core)

---

## Objetivo general

**Mudanza de Streamlit (Nexus Core) hacia el stack web:** `rimec-web` + `report`.

Lo que hoy vive en `control_central` (Python/Streamlit) se porta, etapa a etapa, a Next.js con la misma semántica de negocio y BD Supabase.

---

## Objetivo específico (arranque)

**Calcular los precios de costo de mercadería en tránsito** (Pre-Venta / `estado_transito = EN_TRANSITO`).

- Entrada: PP + pilares + evento/caso de precio (motor existente en Nexus).
- Salida: costo unitario / LPN / snapshot usable en catálogo, estadísticas y report — **sin confiar en el navegador**.
- Fuente legacy: `control_central/core/precio_evento_caso.py` y módulos relacionados.
- Destino candidato: `report` (panel analítico) y/o API server en `rimec-web` según sub-etapa.

---

## Reglas de la etapa

1. **Sub-etapas:** se abren **una a una** al avanzar; no mezclar entregables.
2. **Cierre sub-etapa:** evidencia + commit + doc `CERRADA` en tabla abajo.
3. **Streamlit:** sigue operativo hasta que la sub-etapa diga explícitamente «listo para apagar módulo X».
4. **No tocar Bazzar-web** salvo cliente 5000 ya documentado en índice de entes.
5. **Pilares + casos:** estilo/tipo desde `linea_referencia`; precio/caso desde motor + PP + evento (no `linea.caso_id`).

---

## Sub-etapas

| ID | Nombre | Estado | Doc | Entregable |
|----|--------|--------|-----|------------|
| **001** | Costos mercadería en tránsito | 🚧 ACTIVA | [SUBETAPA_001_COSTOS_TRANSITO.md](./SUBETAPA_RIMEC_WEB_001_COSTOS_TRANSITO.md) | Cálculo costo alineado a motor Nexus |
| *002+* | *(por definir al cerrar 001)* | — | — | — |

**Plantilla nueva sub-etapa:** copiar `SUBETAPA_RIMEC_WEB_001_*.md` → incrementar número → registrar fila aquí.

---

## Alcance fuera de esta etapa (por ahora)

- Auth / proxy rimec-web (otra OT si aplica)
- Bazzar publicación MVP (etapa paralela)
- Tablet final (etapa paralela)
- Bancard

---

## Cierre de etapa madre

La etapa **RIMEC WEB** cierra cuando:

- [ ] Sub-etapas acordadas con Director están **CERRADAS**
- [ ] Módulos Streamlit migrados tienen paridad verificada
- [ ] `ETAPAS_ABIERTAS.md` actualizado (sacar de lista o marcar CERRADA)
- [ ] Evidencia en `CHUSAR_ETAPA_RIMEC_WEB.md`

---

## Documentos

| Doc | Uso |
|-----|-----|
| [ETAPAS_ABIERTAS.md](./ETAPAS_ABIERTAS.md) | Lista corta global |
| [SUBETAPA_RIMEC_WEB_001_COSTOS_TRANSITO.md](./SUBETAPA_RIMEC_WEB_001_COSTOS_TRANSITO.md) | Primera sub-etapa |
| [../3_arquitectura/3.2_venta_tienda/CHUSAR_ETAPA_RIMEC_WEB.md](../3_arquitectura/3.2_venta_tienda/CHUSAR_ETAPA_RIMEC_WEB.md) | Memoria Chusar / bitácora |

---

*Etapa abierta por Director — 2026-06-16.*
