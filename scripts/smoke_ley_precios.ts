import assert from 'node:assert/strict'
import {
  getPrecioActivo,
  getPrecioActivoPe,
  lpcDesdeLpn,
  redondearCentenaGs,
} from '../lib/precioLista'

assert.equal(redondearCentenaGs(230_048), 230_000)
assert.equal(redondearCentenaGs(230_051), 230_100)

assert.equal(lpcDesdeLpn(205_400, 1.12), 230_000)
assert.equal(lpcDesdeLpn(205_402, 1.12), 230_100)

const lpn = 128_300
const row = { lpn, lpc02: null as number | null, lpc03: null as number | null, lpc04: null as number | null }

assert.equal(getPrecioActivo(row, 1), lpn)
assert.equal(getPrecioActivo(row, 3), redondearCentenaGs(lpn * 1.12))
assert.equal(getPrecioActivo(row, 4), redondearCentenaGs(lpn * 1.2))
assert.equal(getPrecioActivo(row, 3, 'PROMOCIONAL'), lpn)
assert.equal(getPrecioActivoPe(row, 3), redondearCentenaGs(lpn * 1.12))

console.log('SMOKE_LEY_PRECIOS_OK', {
  centena_230048: redondearCentenaGs(230_048),
  centena_230051: redondearCentenaGs(230_051),
  lpn,
  lpc03: getPrecioActivo(row, 3),
  lpc04: getPrecioActivo(row, 4),
  promo: getPrecioActivo(row, 3, 'PROMOCIONAL'),
})
