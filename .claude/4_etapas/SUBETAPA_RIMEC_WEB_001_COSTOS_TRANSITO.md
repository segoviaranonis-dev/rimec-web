# SUBETAPA RIMEC-WEB-001 — Precios en tránsito (motor → web)

**Estado:** 🚧 **ACTIVA**  
**Inicio:** 2026-06-16  
**Padre:** [ETAPA_ABIERTA_RIMEC_WEB.md](./ETAPA_ABIERTA_RIMEC_WEB.md)  
**Economía:** [CHUSAR_MOTOR_PRECIOS_ECONOMIA.md](../3_arquitectura/3.2_venta_tienda/CHUSAR_MOTOR_PRECIOS_ECONOMIA.md)

---

## Objetivo

Exponer en `rimec-web` / `report` el **precio de venta mayorista (LPN)** de mercadería **en tránsito**, respetando el motor:

**Biblioteca → Caso (estrategia) → líneas → FOB USD × Índice → LPN (Gs)**

---

## Modelo económico (resumen)

| Factor | Negocio | BD |
|--------|---------|-----|
| 1 | **Margen** (180, 170, 160…) — cubre OPEX + fijos | `factor_conversion` |
| 2 | **Índice de prudencia** (ej. 7.500 Gs/USD) | `dolar_politica` |
| **→** | **Índice de conversión** = (1 × 2) / 100 | `indice_calculado` |

```
LPN (Gs) = redondeo_centena_rimec( FOB_ajustado_USD × ÍNDICE )

**Ley redondeo:** 1.949→1.900 · 1.950→2.000 · 1.951→2.000 — ver `LEY_REDONDEO_MOTOR_PRECIOS.md`
```

Ejemplo: margen **180** × prudencia **7.200** → índice **12.960** Gs/USD.

---

## Contexto operativo

| Concepto | Valor |
|----------|--------|
| Mercadería | Pre-Venta · `estado_transito = EN_TRANSITO` |
| Motor Streamlit | `modules/rimec_engine/` (Nexus #13) |
| Snapshot web | `pedido_proveedor_detalle.precio_lpn` (MIG-073) |
| Catálogo | `v_stock_rimec.lpn` |

---

## Entregables

- [ ] Paridad LPN tránsito: Nexus vs API web
- [ ] Glosario negocio↔BD en Chusar (hecho: `CHUSAR_MOTOR_PRECIOS_ECONOMIA.md`)
- [ ] Server-side only — sin cálculo en cliente
- [ ] Cierre sub-etapa + bitácora

---

*Sub-etapa 001 — RIMEC WEB.*
