/**
 * Smoke MIG-173 — split FI PE por pp_id distinto en mismo lote.
 */
import assert from 'node:assert/strict'
import { asegurarSegregacionPePpPayload } from '../lib/asegurarSegregacionPePpPayload.ts'

const ppMap = new Map<number, number>([
  [1001, 33],
  [1002, 35],
])

function fakeSb() {
  return {
    from(table: string) {
      return {
        select() {
          return this
        },
        in(_col: string, ids: number[]) {
          const data =
            table === 'v_stock_pe_rimec'
              ? ids.map((det_id) => ({ det_id, pp_id: ppMap.get(det_id) ?? null }))
              : []
          return Promise.resolve({ data, error: null })
        },
      }
    },
  }
}

const payload = {
  lotes: [
    {
      origen_pe: true,
      pp_id: -999,
      facturas: [
        {
          marca: 'VIZZANO',
          caso: 'REGULAR',
          items: [
            { det_id: 1001, pares: 8, subtotal: 1000000 },
            { det_id: 1002, pares: 8, subtotal: 1233600 },
          ],
        },
      ],
    },
  ],
}

const { payload: out, facturas_spliteadas } = await asegurarSegregacionPePpPayload(
  fakeSb() as never,
  payload,
)
assert.equal(facturas_spliteadas, 1)
const fis = (out as typeof payload).lotes[0].facturas
assert.equal(fis.length, 2)
assert.equal(fis[0].items?.length, 1)
assert.equal(fis[1].items?.length, 1)
console.log('OK split PE PP 33/35')
