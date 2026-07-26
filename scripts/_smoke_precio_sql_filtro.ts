/**
 * Smoke — filtro precio SQL (columna + apply WHERE).
 * npx tsx rimec-web/scripts/_smoke_precio_sql_filtro.ts
 */
import { applyPrecioSqlFilters, columnaPrecioSql } from '../lib/catalogoPrecioSqlCore'
import type { CatalogoFilterStateExtended } from '../lib/catalogoFilters'

function assert(c: unknown, m: string) {
  if (!c) throw new Error(`FAIL: ${m}`)
}

assert(columnaPrecioSql(1) === 'lpn', 'lista1→lpn')
assert(columnaPrecioSql(3) === 'lpc03', 'lista3→lpc03')

type FakeQ = {
  ops: string[]
  gt(col: string, v: number): FakeQ
  gte(col: string, v: number): FakeQ
  lte(col: string, v: number): FakeQ
}

function fakeQuery(): FakeQ {
  const q: FakeQ = {
    ops: [],
    gt(col, v) {
      q.ops.push(`gt:${col}:${v}`)
      return q
    },
    gte(col, v) {
      q.ops.push(`gte:${col}:${v}`)
      return q
    },
    lte(col, v) {
      q.ops.push(`lte:${col}:${v}`)
      return q
    },
  }
  return q
}

const base: CatalogoFilterStateExtended = {
  grupo_estilo_id: '',
  marca_id: '',
  linea_ids: [],
  tipo_ids: [],
  colores: [],
  quincenas: [],
  lista_precio_id: 1,
  precio_min: 100_000,
  precio_max: 500_000,
  precio_tope: null,
}

const q1 = applyPrecioSqlFilters(fakeQuery(), base) as FakeQ
assert(q1.ops.includes('gt:lpn:0'), 'gt lpn')
assert(q1.ops.includes('gte:lpn:100000'), 'gte min')
assert(q1.ops.includes('lte:lpn:500000'), 'lte max')

const q2 = applyPrecioSqlFilters(fakeQuery(), {
  ...base,
  precio_min: null,
  precio_max: null,
  precio_tope: 250_000,
}) as FakeQ
assert(q2.ops.includes('lte:lpn:250000'), 'tope')

const q3 = applyPrecioSqlFilters(fakeQuery(), {
  ...base,
  precio_min: null,
  precio_max: null,
  precio_tope: null,
}) as FakeQ
assert(q3.ops.length === 0, 'sin filtro no toca query')

console.log('PASS_PRECIO_SQL_FILTRO')
