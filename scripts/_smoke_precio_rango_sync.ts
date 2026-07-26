/**
 * Smoke: teclado ↔ slider ↔ SQL = misma consulta, dos representaciones.
 * npx tsx scripts/_smoke_precio_rango_sync.ts
 */
import { applyPrecioSqlFilters } from '../lib/catalogoPrecioSqlCore'
import {
  draftASqlParams,
  normalizarRangoDraft,
  parsePrecioInput,
  tecladoADraft,
} from '../lib/filtroPrecioRangoSync'

const PISO = 24_700
const TOPE = 384_700

type FakeQ = { ops: string[]; gte: Function; lte: Function; gt: Function }

function fakeQuery(): FakeQ {
  const q: FakeQ = {
    ops: [],
    gt(col: string, v: number) {
      q.ops.push(`gt(${col},${v})`)
      return q
    },
    gte(col: string, v: number) {
      q.ops.push(`gte(${col},${v})`)
      return q
    },
    lte(col: string, v: number) {
      q.ops.push(`lte(${col},${v})`)
      return q
    },
  }
  return q
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

// 1) Parse teclado (puntos / basura)
assert(parsePrecioInput('53.000') === 53000, 'parse 53.000')
assert(parsePrecioInput('150000') === 150000, 'parse 150000')
assert(parsePrecioInput('abc') === null, 'parse basura')
assert(parsePrecioInput('') === null, 'parse vacío')

// 2) Invertidos se ordenan
{
  const { lo, hi } = normalizarRangoDraft(150_000, 53_000, PISO, TOPE)
  assert(lo === 53_000 && hi === 150_000, 'invertidos')
}

// 3) Teclado → draft (espejo slider)
{
  const d = tecladoADraft('53000', '150000', PISO, TOPE, PISO, TOPE)
  assert(d.lo === 53_000 && d.hi === 150_000, 'teclado draft 53k-150k')
  assert(d.minFmt.includes('53'), 'fmt min')
}

// 4) Draft → SQL params (misma consulta)
{
  const sql = draftASqlParams(53_000, 150_000, PISO, TOPE)
  assert(sql.precio_min === 53_000 && sql.precio_max === 150_000, 'sql params')
  const q = applyPrecioSqlFilters(fakeQuery(), {
    lista_precio_id: 1,
    precio_min: sql.precio_min,
    precio_max: sql.precio_max,
  }) as FakeQ
  assert(q.ops.includes('gte(lpn,53000)'), 'SQL gte')
  assert(q.ops.includes('lte(lpn,150000)'), 'SQL lte')
}

// 5) Extremos = null (sin filtro)
{
  const sql = draftASqlParams(PISO, TOPE, PISO, TOPE)
  assert(sql.precio_min === null && sql.precio_max === null, 'extremos null')
}

// 6) Slider path = teclado path (misma normalización)
{
  const desdeSlider = normalizarRangoDraft(53_000, 150_000, PISO, TOPE)
  const desdeTeclado = tecladoADraft('53.000', '150.000', PISO, TOPE, PISO, TOPE)
  assert(desdeSlider.lo === desdeTeclado.lo && desdeSlider.hi === desdeTeclado.hi, 'espejo paths')
  const a = draftASqlParams(desdeSlider.lo, desdeSlider.hi, PISO, TOPE)
  const b = draftASqlParams(desdeTeclado.lo, desdeTeclado.hi, PISO, TOPE)
  assert(a.precio_min === b.precio_min && a.precio_max === b.precio_max, 'misma consulta')
}

console.log('PASS_PRECIO_RANGO_SYNC')
