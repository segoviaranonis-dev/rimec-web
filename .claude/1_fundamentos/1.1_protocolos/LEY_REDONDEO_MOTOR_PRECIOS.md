# LEY DE REDONDEO — Motor de precios RIMEC

**Estado:** LEY OPERATIVA — obligatoria en Nexus, rimec-web, report y SQL.  
**Ámbito:** LPN, LPC02, LPC03, LPC04 y cualquier precio mayorista derivado del motor.  
**Padre analítico:** `CHUSAR_MOTOR_PRECIOS_ECONOMIA.md`

---

## Regla única

Todo precio en guaraníes que salga del motor se redondea a la **centena más próxima** (no truncar, no `floor`).

```
LPN_bruto = FOB_ajustado_USD × ÍNDICE
LPN       = redondeo_centena_rimec(LPN_bruto)
```

---

## Tabla canónica (Director)

| Valor bruto (Gs) | Precio final |
|------------------|--------------|
| **1.949** | **1.900** |
| **1.950** | **2.000** ← empate ·50 **sube** |
| **1.951** | **2.000** |

**Ley del empate ·50:** si el residuo es **exactamente 50** guaraníes sobre la centena inferior, se redondea **hacia arriba** (1.950 → 2.000).

---

## Definición formal

Sea `v` el valor en guaraníes antes de redondear:

1. Dividir por 100: `q = v / 100`
2. Redondear al entero más próximo; en empate **·5** (equivalente a residuo 50 Gs), **hacia arriba**
3. Multiplicar por 100

**Pseudocódigo (referencia implementación):**

```python
def redondeo_centena_rimec(v: float) -> int:
    # Empate ·50 sube: round half UP, no floor
    return int(math.floor(v / 100 + 0.5)) * 100
```

```typescript
export function redondeoCentenaRimec(v: number): number {
  return Math.round(v / 100) * 100  // JS: 1950/100=19.5 → 20 → 2000 ✓
}
```

```sql
-- PostgreSQL
ROUND(valor::numeric, -2)
```

---

## Aplica también a LPC

Tras calcular LPC03 (+12 %) o LPC04 (+20 %) sobre LPN, **volver a aplicar** `redondeo_centena_rimec` al resultado.

---

## ❌ Prohibido (incumplimiento = bug)

| Implementación | Estado |
|----------------|--------|
| `math.floor(x / 100) * 100` | **REVOCADO** |
| `Math.floor(precio / 100) * 100` | **REVOCADO** |
| Truncar / castear a int sin redondear | **REVOCADO** |

---

## Deuda técnica auditada (2026-06-16)

| Ubicación | Función | Estado |
|-----------|---------|--------|
| `modules/rimec_engine/logic.py` (Nexus) | `redondeo_centena_inferior` | 🔴 **INCORRECTO** — corregir en Nexus |
| `calcular_precio_lista_evento_sql` (Supabase) | SQL masivo paso 3 | 🔴 **Verificar** — alinear a `ROUND(..., -2)` |
| `store/sesionVenta.ts` (rimec-web) | `calcularPrecioNeto` | ✅ Corregido 2026-06-16 |
| Migración web / report | — | 🟡 Pendiente al portar motor |

**Paridad:** tras corregir código, recalcular muestra de SKUs y comparar con tabla canónica (1949/1950/1951).

---

**Versión:** 1.0.0 · **2026-06-16** · Aprobación Director (redondeo centena más próxima)
