# CHUSAR — Motor de precios · visión económica (analítica)

**Dominio:** 3.2 venta / preventa  
**Etapa:** RIMEC WEB · sub-etapa 001  
**Estado:** LEY OPERATIVA — alinear agentes y migración Streamlit → web

---

## 1. Qué es el motor (modelo mental)

El **Motor de Precios** no es una fórmula suelta: es una **Biblioteca de Casos**.

```
BIBLIOTECA (biblioteca_precio)
    └── CASO = ESTRATEGIA (caso_precio_biblioteca / precio_evento_caso)
            └── LISTADO DE LÍNEAS (biblioteca_caso_linea + excepciones)
                    └── cada SKU (L + R + Material) hereda la estrategia del caso
                            └── FOB proveedor (USD) → PRECIO DE VENTA RIMEC (Gs, LPN)
```

**Streamlit:** módulo `modules/rimec_engine/` (registry Nexus #13 «Motor de Precios»).  
**Evento operativo:** al cerrar un listado se materializa en `precio_evento` + `precio_lista`; al vincular PP queda congelado en `pedido_proveedor_detalle`.

---

## 2. Caso = Estrategia comercial

Un **caso** agrupa productos con la **misma política económica**: margen objetivo + prudencia cambiaria + descuentos FOB.

Ejemplos vivos en biblioteca (2026-06):

| Caso | Margen | Prudencia (Gs/USD) | Índice conversión |
|------|--------|--------------------|-------------------|
| ACT-BRSPORT | **170** | 8.000 | **13.600** |
| BR-VZ-MD-ML-MKA-O | **180** | 8.000 | **14.400** |
| PROMOCIONAL | **170** | 7.500 | **12.750** |
| CARTERAS / CHINELO | **170** | 8.000 | **13.600** |

---

## 3. Los dos factores determinantes (+ el índice resultante)

### Factor 1 — Margen de conversión (estrategia de rentabilidad)

- **Qué es:** el margen que la empresa coloca sobre el costo importado para cubrir **gastos operativos + costos fijos + utilidad**.
- **Valores típicos:** 180, 170, 160 (y otros por caso).
- **En BD / código:** `factor_conversion` en `caso_precio_biblioteca` y `precio_evento_caso`.
- **Nombre legacy CONTEXTO_PPT:** `margen_conversion` (ej. 180%).

> No confundir con descuentos FOB (d1–d4): esos reducen el **costo de entrada** antes de aplicar el índice.

### Factor 2 — Índice de prudencia (tipo de cambio defensivo)

- **Qué es:** cuántos **guaraníes** asignamos a **cada unidad monetaria del proveedor** (USD), **anticipando** movimientos del dólar.
- **Ejemplo Director:** 7.500 Gs/USD (más conservador que spot si el mercado sube).
- **En BD / código:** `dolar_politica`.
- **Nombre legacy CONTEXTO_PPT:** `cotizacion`.

### Factor 3 — Índice de conversión (resultado 1 × 2, escala RIMEC)

- **Fórmula canónica:**

```
ÍNDICE = (Índice de prudencia × Margen) / 100
       = (dolar_politica × factor_conversion) / 100
```

- **Unidad:** guaraníes por **cada dólar FOB** (después de descuentos) que entra al caso.
- **En BD:** columna generada `indice_calculado` en `precio_evento_caso`.

**Ejemplos numéricos:**

| Margen | Prudencia | Cálculo | Índice |
|--------|-----------|---------|--------|
| 180 | 8.000 | 8.000 × 180 / 100 | **14.400** |
| 170 | 8.000 | 8.000 × 170 / 100 | **13.600** |
| 170 | 7.500 | 7.500 × 170 / 100 | **12.750** |
| 180 | 7.200 | 7.200 × 180 / 100 | **12.960** |

*(12.960 = ejemplo Director con prudencia 7.200 y margen 180; con prudencia 7.500 el índice sería 13.500.)*

---

## 4. De moneda proveedor a precio de venta (cadena completa)

```
FOB fábrica (USD, Excel proveedor)
        ↓  descuentos comerciales d1, d2, d3, d4 (opcionales)
FOB ajustado (USD)
        ↓  × ÍNDICE de conversión del CASO asignado a la LÍNEA
LPN bruto (Gs)
        ↓  redondeo a centena (implementación: centena inferior — ver §6)
LPN = PRECIO DE VENTA mayorista base (Gs)
        ↓  opcional si genera_lpc03_lpc04
LPC03 (+12%), LPC04 (+20%) sobre LPN
```

**Código Streamlit** (`modules/rimec_engine/logic.py`):

```python
indice = (dolar_politica * factor_conversion) / 100
lpn = floor(fob_ajustado * indice / 100) * 100
```

**SQL masivo:** función `calcular_precio_lista_evento_sql(evento_id)` — misma lógica en `precio_lista`.

---

## 5. Biblioteca → líneas → evento → tránsito

| Capa | Tabla | Rol económico |
|------|-------|----------------|
| Biblioteca | `biblioteca_precio` | Contenedor de estrategias reutilizables |
| Caso plantilla | `caso_precio_biblioteca` | Margen + prudencia + descuentos + nombre estrategia |
| Líneas del caso | `biblioteca_caso_linea` | Qué **líneas** pertenecen a qué estrategia (exclusividad por biblioteca) |
| Evento / listado | `precio_evento` | Instancia operativa (Excel cargado, fechas vigencia) |
| Casos del evento | `precio_evento_caso` | Copia viva de estrategias para ese listado |
| Excepción línea | `precio_evento_linea_excepcion` | Línea X usa caso Y distinto al default del evento |
| Precio calculado | `precio_lista` | FOB, LPN, LPC por triplete L+R+Material |
| Congelado tránsito | `pedido_proveedor_detalle` | `precio_lpn`, `precio_lpc03`, `precio_lpc04` — **no recalcular en web** |
| Catálogo web | `v_stock_rimec` | Expone `lpn` / LPC al mayorista |

**Enlace PP:** `intencion_compra.precio_evento_id` → `pedido_proveedor` → detalle con snapshot MIG-073.

---

## 6. Verificación analítica (¿documentación = realidad?)

| Afirmación Director | ¿En doc/code? | Evidencia |
|---------------------|---------------|-----------|
| Motor = biblioteca de casos | ✅ | `biblioteca_precio`, `caso_precio_biblioteca`, `rimec_engine` |
| Caso = estrategia | ✅ | CONTEXTO_PPT + tablas caso |
| Caso tiene listado de líneas | ✅ | `biblioteca_caso_linea`, excepciones evento |
| Factor margen (180/170/160…) | ✅ | `factor_conversion` |
| Factor prudencia cambiaria (7500…) | ✅ | `dolar_politica` |
| Índice = margen × prudencia (escala /100) | ✅ | `indice_calculado` GENERATED; datos biblioteca cuadran |
| FOB USD → precio venta Gs vía índice | ✅ | `calcular_precios_caso`, `precio_lista` |
| Redondeo centena | ⚠️ | Negocio dice «centena más próxima»; **código hoy = centena inferior** (`floor`) |

---

## 7. Glosario negocio ↔ técnico

| Negocio (Héctor) | Técnico (BD / código) |
|------------------|------------------------|
| Biblioteca | `biblioteca_precio` |
| Caso / Estrategia | `caso_precio_biblioteca`, `precio_evento_caso` |
| Margen | `factor_conversion` |
| Índice de prudencia | `dolar_politica` |
| Índice (de conversión) | `indice_calculado` |
| Listado / evento | `precio_evento` |
| Precio venta mayorista (Gs) | `lpn` en `precio_lista` / `pedido_proveedor_detalle` |
| Costo entrada proveedor | `fob_fabrica` → `fob_ajustado` |

**Nota sub-etapa 001:** en operación RIMEC el **LPN es el precio de venta al mayorista** (lista nacional), no un «costo interno» aparte. El costo de entrada es el **FOB USD** (ajustado).

---

## 8. Anti-patrones económicos

1. Usar `linea.caso_id` — **revocado**; el caso vive en evento + excepciones + biblioteca.
2. Recalcular LPN en rimec-web desde `precio_lista` si PPD ya tiene snapshot.
3. Mezclar motor **WEB** (`caso_precio_web_regla`, markup Bazzar) con motor **mayorista** (LPN/LPC).
4. Tratar el índice como «solo tipo de cambio» — incluye **margen estratégico** completo.

---

**Versión:** 1.0.0 · **2026-06-16** · Validado contra `caso_precio_biblioteca` y `modules/rimec_engine/logic.py`
