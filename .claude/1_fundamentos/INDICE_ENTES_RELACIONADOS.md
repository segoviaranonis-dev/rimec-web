# ÍNDICE DE ENTES RELACIONADOS — Política general del holding

**Estado:** LEY OPERATIVA — aplica a **todo** agente y **todo** proyecto del ecosistema RIMEC / PPT.  
**Jerarquía:** Mismo nivel que **Proveedores**. Leer **antes** de documentación de dominio o código transversal.

**Raíz canónica:** `C:\Users\hecto\Nexus_Core\.claude\1_fundamentos\INDICE_ENTES_RELACIONADOS.md`  
**Réplica sub-repo:** `rimec-web/.claude/1_fundamentos/INDICE_ENTES_RELACIONADOS.md`

---

## Orden de lectura (fundamentos)

1. `.claude/MORIA_PRIMARIA.md`
2. `.claude/4_etapas/ACTUAL.md`
3. **`.claude/1_fundamentos/INDICE_ENTES_RELACIONADOS.md`** ← este archivo
4. `.claude/1_fundamentos/1.1_protocolos/PROTOCOLO_DOCUMENTACION_CHUSAR.md`
5. `.claude/3_arquitectura/<dominio>/CHUSAR_*.md` según tarea

---

## Niveles del índice

| Nivel | Tipo | Descripción | Detalle |
|-------|------|-------------|---------|
| **A** | **Proveedores** | Fabricantes / importación (código de proveedor en pilares) | Ver sección [Proveedores](#proveedores) |
| **B** | **Entes Bazzar** | Tiendas físicas de liquidación + canal virtual | Ver sección [Entes Bazzar](#entes-bazzar) y `CHUSAR_ENTES_BAZZAR.md` |
| **C** | **Clientes mayoristas RIMEC** | ~350–400 tiendas B2B (preventa / stock) | Fuente operativa: `cliente_v2` — **no** mezclar con entes Bazzar sin política explícita |

**Regla:** Los entes Bazzar son **clientes internos del holding** en `cliente_v2` (`tipo = 'MAYORISTA'`), pero operativamente son **entes relacionados** al mismo nivel que proveedores para stock, depósito y liquidación.

---

## Proveedores

| Campo | Valor |
|-------|-------|
| Identificador | Código de proveedor en pilares (ej. Beira Rio) |
| Fuente | Pilares (`linea`, `referencia`, …), Nexus depósito |
| Documentación dominio | Nexus_Core — catálogo de proveedores (canónico en monorepo) |

Todo producto se registra con **código del fabricante** (importadora, no fabricante). Ver `CONTEXTO_PPT.md` — Corazón 1 Pilares.

---

## Entes Bazzar

**Total operativo documentado:** **7 entes** (6 físicos segmentados + 1 virtual unificado).

| # | Ente | Sucursal / canal | Segmento | `id_cliente` | Nombre en `cliente_v2` |
|---|------|------------------|----------|--------------|------------------------|
| 1 | Bazzar Fernando | Avda. Fernando | Adultos | **2100** | BAZZAR (AVDA.FERNANDO) DE SERGIO MARTINEZ O'H |
| 2 | Bazzar Fernando | Avda. Fernando | Niños | **2900** | BAZZAR NInOS (AVDA.FERNANDO) DE SERGIO MARTIN |
| 3 | Bazzar San Martín | San Martín | Adultos | **2400** | BAZZAR (SAN MARTIN) DE SERGIO MARTINEZ O'HIGG |
| 4 | Bazzar San Martín | San Martín | Niños | **2700** | BAZZAR NINOS DE SERGIO DANIEL MARTINEZ O'HIGG |
| 5 | Bazzar Palma | Palma | Adultos | **3100** | BAZZAR (PALMA) DE SERGIO DANIEL MARTINEZ OHIG |
| 6 | Bazzar Palma | Palma | Niños | **3200** | BAZZAR NINOS (PALMA) DE SERGIO MARTINEZ OHIGG |
| 7 | **Bazzar-web** | Virtual (Nexus Core pruebas → producción) | **Adultos + niños** | **5000** | PRUEBA WEB NEXUS |

### Reglas de los 7 entes

- **Físicas:** cada sucursal tiene **dos códigos** (adultos / niños), salvo la web.
- **Bazzar-web (`5000`):** un **solo** `id_cliente` para adultos y niños. Estado actual: cuenta de prueba Nexus Core; **próximo** cliente canónico de `bazzar-web`.
- **No documentar como entes operativos** (cuentas legacy / contables / transferencias):

| `id_cliente` | Motivo de exclusión |
|--------------|---------------------|
| 1726 | Matriz / cuenta histórica — no ente operativo de sucursal |
| 2890 | Gran Bazzar Lucky — entidad legal distinta del índice operativo |
| 2898 | Transferencia interna suc. Fernando |
| 2899 | Transferencia interna suc. San Martín |

Detalle ampliado: `.claude/3_arquitectura/3.3_liquidacion_bazzar/CHUSAR_ENTES_BAZZAR.md`

---

## Uso por proyecto

| Proyecto | Entes relevantes |
|----------|------------------|
| **Nexus Core** | Proveedores, depósito → Bazzar, índice completo |
| **rimec-web** | Clientes mayoristas (nivel C); **no mezclar** con Bazzar-web (`AGENTS.md`) |
| **bazzar-web** | Ente **5000** (futuro canónico); stock vía `v_stock_web` |
| **report** | Inteligencia histórica — respetar segmentación A/B/C |

---

## Checklist agente

- [ ] ¿Leí este índice **antes** de tocar dominio o código transversal?
- [ ] ¿Distinguí proveedor (A) vs ente Bazzar (B) vs mayorista RIMEC (C)?
- [ ] ¿Usé solo los **7** códigos Bazzar documentados?
- [ ] ¿Excluí 1726, 2890, 2898, 2899 de lógica operativa Bazzar?

---

**Versión:** 1.0.0  
**Fecha:** 2026-06-16  
**Autor:** Héctor Segovia + agente cloud (política entes Bazzar)
