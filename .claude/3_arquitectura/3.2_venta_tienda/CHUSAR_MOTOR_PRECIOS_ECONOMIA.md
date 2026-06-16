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
        ↓  LEY REDONDEO — centena más próxima (ver §6 y LEY_REDONDEO_MOTOR_PRECIOS.md)
LPN = PRECIO DE VENTA mayorista base (Gs)
        ↓  opcional si genera_lpc03_lpc04 (+ misma ley de redondeo)
LPC03 (+12%), LPC04 (+20%) sobre LPN
```

**Fórmula índice:**

```python
indice = (dolar_politica * factor_conversion) / 100
lpn_bruto = fob_ajustado * indice
lpn = redondeo_centena_rimec(lpn_bruto)  # LEY — no floor
```

**Implementación canónica hoy en Nexus (`logic.py`):** 🔴 **INCORRECTA** — usa `floor`; debe alinearse a la ley.

**SQL masivo:** función `calcular_precio_lista_evento_sql(evento_id)` — verificar paridad con la ley.

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

## 6. LEY DE REDONDEO (centena más próxima)

**Documento ley:** `.claude/1_fundamentos/1.1_protocolos/LEY_REDONDEO_MOTOR_PRECIOS.md`

| Bruto (Gs) | LPN final |
|------------|-----------|
| 1.949 | **1.900** |
| 1.950 | **2.000** (empate ·50 → sube) |
| 1.951 | **2.000** |

- **Prohibido:** `floor`, truncar, centena inferior.
- **Obligatorio:** centena **más próxima**; empate en ·50 **hacia arriba**.

---

## 7. Verificación analítica (auditoría Director ↔ sistema)

| Afirmación Director | Doc | Código hoy |
|---------------------|-----|------------|
| Motor = biblioteca de casos | ✅ | ✅ |
| Caso = estrategia + líneas | ✅ | ✅ |
| Margen × prudencia = índice | ✅ | ✅ |
| FOB → LPN vía índice | ✅ | ✅ |
| Redondeo centena **más próxima** | ✅ **LEY** | 🟡 Nexus/SQL pendiente · rimec-web carrito ✅ |

---

## 8. Glosario negocio ↔ técnico

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
| Redondeo LPN/LPC | `redondeo_centena_rimec` — ley §6 |

**Nota sub-etapa 001:** el **LPN es precio de venta mayorista** (Gs). El **FOB USD ajustado** es costo de entrada.

---

## 9. Anti-patrones económicos

1. Usar `linea.caso_id` — **revocado**; el caso vive en evento + excepciones + biblioteca.
2. Recalcular LPN en rimec-web desde `precio_lista` si PPD ya tiene snapshot.
3. Mezclar motor **WEB** (`caso_precio_web_regla`, markup Bazzar) con motor **mayorista** (LPN/LPC).
4. Tratar el índice como «solo tipo de cambio» — incluye **margen estratégico** completo.
5. Usar **`floor` para centena** — viola `LEY_REDONDEO_MOTOR_PRECIOS.md`.

---

## 10. «Diccionario de precios» — auditoría de término (Director)

**Teoría Director:** «diccionario de precios» en el motor es vestigio de lógica anterior a Biblioteca + Casos.

### Veredicto: **mayormente correcta**, con matices

| Uso de «diccionario» | ¿Está en Motor de Precios? | ¿Vestigio? |
|----------------------|----------------------------|------------|
| **«Diccionario Precios Web»** (`modules/web_precio_caso`) | ❌ **Módulo aparte** (#13.5 Nexus), no `rimec_engine` | Canal Bazzar-web: `caso_precio_web_regla` (markup sobre LPN). Nombre confunde con el motor. |
| **Pestaña «Casos (legacy)»** en UI motor | ✅ Sí (`ui.py` → `_render_biblioteca_legacy`) | ✅ **Vestigio** — explícito en código: *«ya no define precios; cada listado lleva su propia matriz»* |
| **`caso_precio_biblioteca` sin `biblioteca_precio`** (modelo plano por proveedor) | ✅ Parcial | ✅ Pre-migración **044**; reemplazado por Biblioteca → Casos → Líneas |
| **`listado_precio`** (LPN/LPC02/03/04) | En IC/PP, no en motor | ❌ **No es diccionario** — catálogo de **tipos de lista** (4 filas) |
| **`listado_de_precio_v2`** | Import legacy | ✅ Tabla **vacía** — sistema 654, vestigio |

**Evidencia Nexus (`core/csv_utils.py`):**
> *«Confusión: Diccionario Web vs Motor de Precios»* · *«vestigios de lógica simple anterior»* · *«Debería ser: Biblioteca de Casos → Motor de Precios»*

### Modelo vigente (no vestigio)

```
biblioteca_precio → caso_precio_biblioteca → biblioteca_caso_linea
        ↓ (aplicar a evento)
precio_evento → precio_evento_caso → precio_lista (LPN/LPC)
```

### Regla para agentes

- **Motor de Precios** = `rimec_engine` + biblioteca + evento/listado.
- **«Diccionario»** en docs/código = casi siempre **web** (`caso_precio_web_regla`) o **legacy UI** — no mezclar con estrategia mayorista.
- No revivir pestaña «Casos (legacy)» ni `linea.caso_id`.

---

**Versión:** 1.2.0 · **2026-06-16** · Auditoría término «diccionario»
