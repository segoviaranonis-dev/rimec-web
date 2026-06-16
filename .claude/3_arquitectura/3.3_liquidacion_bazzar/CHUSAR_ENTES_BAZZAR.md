# CHUSAR — Entes Bazzar (liquidación)

**Dominio:** 3.3 liquidación / Bazzar  
**Jerarquía:** Ente relacionado nivel **B** — paridad con Proveedores (ver `INDICE_ENTES_RELACIONADOS.md`)  
**Estado:** Política general del holding — vigente

---

## Propósito

Documentar los **7 entes operativos** de liquidación (6 tiendas físicas segmentadas + 1 canal virtual) y los códigos `id_cliente` en Supabase (`cliente_v2`).

Los Bazzares son competencia de los mayoristas RIMEC en el mercado, pero **pertenecen al mismo holding**. En sistema comparten tabla con clientes (`tipo = MAYORISTA'`) por herencia del legacy; en **documentación y política** se tratan como **entes relacionados**, no como clientes de preventa.

---

## Los 7 entes (canónico)

```
                    ┌─────────────────────────────────────┐
                    │     ÍNDICE ENTES BAZZAR (7)         │
                    └─────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
   FERNANDO                      SAN MARTÍN                       PALMA
   ┌────┴────┐                   ┌────┴────┐                   ┌────┴────┐
   │         │                   │         │                   │         │
 Adultos   Niños              Adultos   Niños              Adultos   Niños
  2100     2900                 2400     2700                 3100     3200

                    ┌─────────────────────────────────────┐
                    │  BAZZAR-WEB (virtual) — 5000        │
                    │  Adultos + niños → un solo código   │
                    │  PRUEBA WEB NEXUS → canónico futuro │
                    └─────────────────────────────────────┘
```

| Ente | `id_cliente` | Segmento | Notas |
|------|--------------|----------|-------|
| Bazzar Fernando | 2100 | Adultos | Avda. Fernando |
| Bazzar Fernando | 2900 | Niños | Avda. Fernando |
| Bazzar San Martín | 2400 | Adultos | |
| Bazzar San Martín | 2700 | Niños | Nombre legacy en DB sin calle; sucursal San Martín infantil |
| Bazzar Palma | 3100 | Adultos | |
| Bazzar Palma | 3200 | Niños | |
| **Bazzar-web** | **5000** | **Adultos + niños** | Cuenta **PRUEBA WEB NEXUS** hoy; será el cliente único de `bazzar-web` |

### Bazzar-web (`5000`)

- **Un código, dos segmentos de producto:** adultos y niños bajo el mismo `id_cliente`.
- **Estado:** pruebas Nexus Core / smoke tests (`execute_smoke_test.py`, Playwright).
- **Transición:** al pasar `bazzar-web` a producción, **5000** permanece como cliente canónico del canal virtual (renombrar descripción en `cliente_v2` cuando operación lo indique).
- **No duplicar** códigos separados adultos/niños para la web.

---

## Códigos excluidos de este índice

No usar como entes operativos Bazzar en agentes, reportes ni flujos de depósito:

| `id_cliente` | Nombre (referencia DB) | Por qué se excluye |
|--------------|------------------------|--------------------|
| 1726 | BAZZAR de SERGIO MARTINEZ O'HIGGINS | Cuenta matriz / histórica |
| 2890 | GRAN BAZZAR DE LUCKY IMPORT EXPORT S.A. | Entidad legal Lucky — fuera del índice operativo de sucursales |
| 2898 | TRANSFERENCIA A SUC.FERNANDO (BAZZAR) | Movimiento contable interno |
| 2899 | TRANSFERENCIA A SUC.SAN MARTIN (BAZZAR) | Movimiento contable interno |

Si un agente encuentra estos IDs en consultas ad hoc, **no** asumir que son sucursales activas del índice de 7 entes.

---

## Relación con el ecosistema

| Capa | Rol Bazzar |
|------|------------|
| **PPT / Pre-venta** | Fracaso de venta en tránsito → stock → liquidación |
| **Depósito (Nexus)** | Envío a tiendas físicas o a Bazzar-web |
| **bazzar-web** | Ecommerce B2C; catálogo/stock vía `v_stock_web` |
| **rimec-web** | **No tocar Bazzar** desde este repo (`AGENTS.md`) |

Referencia de negocio: `CONTEXTO_PPT.md` — jerarquía de eficiencia, nivel 4 BAZZAR (liquidación).

---

## Consulta SQL de verificación

```sql
SELECT id_cliente, descp_cliente, tipo
FROM cliente_v2
WHERE id_cliente IN (2100, 2900, 2400, 2700, 3100, 3200, 5000)
ORDER BY id_cliente;
```

---

## Anti-patrones

1. Listar **todos** los `ILIKE '%bazzar%'` de `cliente_v2` sin filtrar exclusiones.
2. Tratar **5000** solo como smoke test de rimec-web sin documentar su rol futuro Bazzar-web.
3. Crear códigos separados adultos/niños para la web cuando la política es **un solo ente (5000)**.
4. Confundir entes Bazzar (B) con mayoristas de preventa (C).

---

**Versión:** 1.0.0  
**Fecha:** 2026-06-16  
**Índice padre:** `.claude/1_fundamentos/INDICE_ENTES_RELACIONADOS.md`
