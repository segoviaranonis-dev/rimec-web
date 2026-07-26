import assert from 'node:assert/strict'
import {
  getPrecioActivo,
  getPrecioActivoPe,
  lpcDesdeBaseBruta,
  lpcDesdeLpn,
  redondearCentenaGs,
} from '../lib/precioLista'

assert.equal(redondearCentenaGs(230_048), 230_000)
assert.equal(redondearCentenaGs(230_051), 230_100)

// Excel Listado 7200 · fila 3 · FOB 10.94 · índice 12960
const lpnRaw = 10.94 * 12_960
assert.equal(redondearCentenaGs(lpnRaw), 141_800)
assert.equal(lpcDesdeBaseBruta(lpnRaw, 1.12), 158_800)
assert.equal(lpcDesdeBaseBruta(lpnRaw, 1.2), 170_100)

// Legacy fallback (solo LPN redondeado) puede diferir ±100
assert.equal(lpcDesdeLpn(141_800, 1.2), 170_200)

const lpn = 141_800
const row = {
  lpn,
  lpn_raw: lpnRaw,
  lpc02: null as number | null,
  lpc03: null as number | null,
  lpc04: null as number | null,
}

assert.equal(getPrecioActivo(row, 1), lpn)
assert.equal(getPrecioActivo(row, 3), 158_800)
assert.equal(getPrecioActivo(row, 4), 170_100)
assert.equal(getPrecioActivo(row, 3, 'PROMOCIONAL'), lpn)
assert.equal(getPrecioActivo(row, 4, 'PROMOCIONAL'), lpn)
assert.equal(getPrecioActivoPe(row, 3), 158_800)

const rowStored = { ...row, lpc03: 158_800, lpc04: 170_100 }
assert.equal(getPrecioActivo(rowStored, 3), 158_800)

const rowSinSnapshot = { lpn, lpc02: null, lpc03: null, lpc04: null }
assert.equal(getPrecioActivo(rowSinSnapshot, 3), null)
assert.equal(getPrecioActivo({ ...row, lpc03: 999_999, lpc04: null }, 3, 'PROMOCIONAL'), lpn)

console.log('SMOKE_LEY_PRECIOS_OK', {
  lpnRaw,
  lpn,
  lpc03: getPrecioActivo(row, 3),
  lpc04: getPrecioActivo(row, 4),
  promo3: getPrecioActivo(row, 3, 'PROMOCIONAL'),
})
