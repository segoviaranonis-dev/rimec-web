# SUBETAPA RIMEC-WEB-001 — Costos mercadería en tránsito

**Estado:** 🚧 **ACTIVA**  
**Inicio:** 2026-06-16  
**Padre:** [ETAPA_ABIERTA_RIMEC_WEB.md](./ETAPA_ABIERTA_RIMEC_WEB.md)

---

## Objetivo

Portar / replicar el **cálculo de precio de costo** de mercadería **en tránsito** (Pre-Venta) desde Streamlit Nexus hacia el stack web (`report` / `rimec-web`).

---

## Contexto operativo

| Concepto | Valor |
|----------|--------|
| Tipo mercadería | Pre-Venta — venta en tránsito |
| Filtro PP | `pedido_proveedor.estado_transito = 'EN_TRANSITO'` |
| Pilares | linea + referencia + material + color + talla/grada |
| Motor legacy | `control_central/core/precio_evento_caso.py` |
| Casos / índice | Biblioteca de casos (`caso`, `precio_evento`, `biblioteca_precio`) |
| Web existente | `rimec-web/lib/controlStock/` (árbol PP, sin costos aún) |
| Report | Panel `/estadisticas`, módulos bazzar-web como referencia de clon Streamlit |

---

## Entregables (checklist)

- [ ] Inventario: qué campos usa Streamlit hoy para **costo** en tránsito (tablas + funciones)
- [ ] Definición canónica: costo vs LPN vs precio venta (glosario corto en Chusar)
- [ ] Implementación server-side (report y/o rimec-web API) — **sin** cálculo en cliente
- [ ] Paridad numérica vs Nexus en PP de prueba acordado
- [ ] Doc cierre + marcar sub-etapa CERRADA en etapa madre

---

## Fuera de scope (001)

- Precio de **venta** al mayorista (carrito rimec-web) — puede ser sub-etapa 002+
- Stock físico / depósito / Bazzar
- Migración UI completa de un módulo Streamlit entero

---

## Criterio de cierre 001

1. Costo calculado para filas en tránsito coincide con Nexus en muestra acordada.
2. Código en repo + PR mergeado.
3. Fila 001 en `ETAPA_ABIERTA_RIMEC_WEB.md` → **CERRADA**.
4. Bitácora en `CHUSAR_ETAPA_RIMEC_WEB.md`.

---

## Próxima acción

Inventariar funciones Streamlit de costo en tránsito y proponer **SUBETAPA 002** (Director aprueba).

---

*Sub-etapa 001 — RIMEC WEB.*
