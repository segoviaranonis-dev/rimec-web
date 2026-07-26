/**
 * Smoke siamese — labels TIPO PE diccionario Web = Report (MAYÚSCULAS).
 */
import assert from 'node:assert/strict'
import {
  PE_TIPO_DICCIONARIO_OPCIONES,
  rowMatchesPeTipoDiccionario,
  parsePeTipoSelected,
} from '../lib/filtros/filtro-tipo-pe-diccionario.ts'
import { cadenaPeCanonico } from '../lib/filtros/pe-grupo-uno-visual.ts'

const CANON = ['NORMAL', 'PROMOCIONAL', 'LIQUIDACION', 'COMUN']
for (const row of PE_TIPO_DICCIONARIO_OPCIONES) {
  assert.equal(row.label, row.label.toUpperCase(), `label minúscula: ${row.label}`)
  assert.ok(CANON.includes(row.label), `label fuera de canon: ${row.label}`)
}

const comunCadena = { cadena_comercial: 'COMUN', es_liquidacion: false, es_promo: false }
assert.equal(cadenaPeCanonico(comunCadena), 'COMUN')
assert.ok(rowMatchesPeTipoDiccionario(comunCadena, parsePeTipoSelected(['comun'])))
assert.ok(!rowMatchesPeTipoDiccionario(comunCadena, parsePeTipoSelected(['normal'])))

console.log('OK smoke PE tipo diccionario siamese —', PE_TIPO_DICCIONARIO_OPCIONES.map((o) => o.label).join(' · '))
