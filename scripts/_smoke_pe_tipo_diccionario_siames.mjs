/**
 * Smoke siamese — CASOS PE diccionario Web · canon 2.2.1.56
 */
import assert from 'node:assert/strict'
import {
  PE_TIPO_DICCIONARIO_OPCIONES,
  rowMatchesPeTipoDiccionario,
  parsePeTipoSelected,
  peTipoOpcionesVisibles,
} from '../lib/filtros/filtro-tipo-pe-diccionario.ts'

const CANON = ['NORMAL', 'ACTUAL', 'ANTERIOR', 'CHINELO', 'PROMOCIONAL', 'LIQUIDACION', 'COMUN']
for (const row of PE_TIPO_DICCIONARIO_OPCIONES) {
  assert.equal(row.label, row.label.toUpperCase(), `label minúscula: ${row.label}`)
  assert.ok(CANON.includes(row.label), `label fuera de canon: ${row.label}`)
}

assert.ok(rowMatchesPeTipoDiccionario({ cod_grupo: '0901010000' }, parsePeTipoSelected(['chi'])))
assert.ok(!rowMatchesPeTipoDiccionario({ cod_grupo: '0901010000' }, parsePeTipoSelected(['normal'])))
assert.ok(rowMatchesPeTipoDiccionario({ cod_grupo: '1001010100' }, parsePeTipoSelected(['actual'])))
assert.ok(rowMatchesPeTipoDiccionario({ cod_grupo: '1001010200' }, parsePeTipoSelected(['anterior'])))

const calz = peTipoOpcionesVisibles('CALZADO').map((o) => o.id)
assert.ok(calz.includes('chi') && calz.includes('normal') && !calz.includes('actual'))
const conf = peTipoOpcionesVisibles('CONFECCIONES').map((o) => o.id)
assert.ok(conf.includes('actual') && conf.includes('anterior') && !conf.includes('chi'))

console.log(
  'OK smoke PE tipo diccionario siamese —',
  PE_TIPO_DICCIONARIO_OPCIONES.map((o) => o.label).join(' · '),
)
