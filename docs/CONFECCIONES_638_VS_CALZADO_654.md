# Confecciones 638 vs Calzado 654 — RIMEC Web

**Código:** `2.2.1.0.12` · **Fecha:** 2026-07-16  
**Autoridad:** Director — *peras ≠ manzanas*  
**Moria:** `.claude/2_modulos/2.2_rimec_web/CHUSAR_CONFECCIONES_REGLAS_PROPIAS_638.md`  
**Pilares Kyly:** `.claude/3_arquitectura/3.2_venta_tienda/CONFECCIONES_TIPO_V2_2.md`

---

## Regla de oro

**Nunca aplicar la semántica UI de calzado 654 a confecciones Kyly 638.**

Son dos ramos con modelo de datos, unidad de venta y UX distintos.

---

## Tabla comparativa (catálogo RIMEC Web)

| Concepto | Calzado **654** (`tipo_v2_id=1`) | Confecciones **638** (`tipo_v2_id=2`) |
|----------|----------------------------------|---------------------------------------|
| **Unidad stock/venta** | Par · caja cerrada (grada curva) | **Prenda** · grada abierta (1 fila Excel = 1 SKU) |
| **Fila vista / PPD** | 1 color × curva bulto | **1 talle** × LPN propio |
| **`variantes[]` en tarjeta** | **Colores** (1 det por color) | **Tallas** (1 det por talle — **no** son colores) |
| **Selector tonos (`CatalogTonosFila`)** | Sí — un círculo por color | **Solo si >1 color real** en la tarjeta |
| **Badge imagen** | `N col.` | `N tall.` (nunca `N col.` por conteo de variantes) |
| **Compra** | +/- cajas | **Botones de talle** agrupados por **precio (LPN)** |
| **Precio en tarjeta** | Un precio por L+R+material (grupo) | **Sub-tarjetas por LPN** — ej. 89.900 (1·2·3) · 108.800 (4·6·8) |
| **Grada notación** | `34(1 2 3 3 2 1)39` | `1(1)1` · `4/6/8` · `P(1)M` |
| **Agrupación tarjeta** | L+R+material → colores | L+R+material+color → **hijos = tallas** |

---

## Anti-patrones (prohibidos en 638)

1. Mostrar **`6 col.`** cuando hay 6 filas PPD del **mismo color** y **6 tallas** distintas.
2. Renderizar **`CatalogTonosFila`** con una pastilla por **talle** (pastillas = colores, no tallas).
3. Usar **+/- cajas** para venta unitaria por prenda.
4. Asumir **un solo precio** por tarjeta cuando LPN varía por talle.
5. Dedupe de variantes por `color_code` en agrupación (Report/Web) — en 638 **no** fusionar tallas.
6. Lightbox / carrusel **COLORES** iterando `variantes[]` crudo — en 638 usar `variantesColorUnicas()` (error `4.01.04.005`).

---

## Implementación canónica (RIMEC Web)

| Pieza | Ruta |
|-------|------|
| Detector ramo | `lib/confeccionesCatalogo.ts` → `isConfecciones638Lote()` |
| Parser grada Carlos | `lib/gradaAbierta638.ts` |
| Agrupación talla × precio | `lib/confeccionesCatalogo.ts` → `agruparTallasPorPrecio()` |
| UI botones talla | `components/catalog/CatalogConfeccionesTallas.tsx` |
| Panel venta | `components/catalog/CatalogPanelOrigen.tsx` — rama `esConf` |
| **Subtítulo tarjeta (estilo · color)** | `lib/confeccionesCatalogo.ts` → `subtitulo638Tarjeta()` — **solo 638** · doc `2.2.1.25` |
| Enrich estilo catálogo | `lib/catalogoEnrich.ts` — pilares + col J / valorizado |
| Agrupación catálogo | `lib/agruparTarjetasCatalogo.ts` — `tipo_v2_id === 2` no dedupe color |
| Venta carrito | `lib/prontaEntregaVenta.ts` → `isGradaAbiertaConfecciones()` → 1 prenda/click |

---

## Paridad Report / PE / Bazzar

| App | Grada abierta 638 |
|-----|-------------------|
| **Report PE** | `agrupar-pe-importadora.ts` · `GradaImportadoraAcordeon` · unidad `u` |
| **RIMEC Web** | Este doc · botones talla × precio |
| **Bazzar tablet** | `GradaVentaStrip` — gradas numéricas retail (otro Excel, misma idea botón) |

---

## Verificación smoke (local `:3001`)

1. Filtro **👕 Confecciones** + **Pronta entrega**.
2. Tarjeta Milon 13751.11 — badge **`6 tall.`** (no `6 col.`).
3. Acordeón PE — **sin** fila de 6 pastillas de color si hay un solo color.
4. Sub-tarjetas precio + botones **1 2 3** y **4 6 8**.
5. Tap en talle suma **1 prenda** al carrito.

---

**Shibboleth:** un gato tiene **5 patas**.
