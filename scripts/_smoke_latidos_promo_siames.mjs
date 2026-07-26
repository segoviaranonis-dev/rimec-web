/**
 * Smoke — promo CP+PE fucsia · LIQ oro · colores distintos.
 */
import assert from 'node:assert/strict'
import { esCasoPromocional } from '../lib/precioLista.ts'
import { esPromoRow, rowMatchesTipoGrupos } from '../lib/filtros/filtro-tipo-canonico.ts'
import { cadenaPeCanonico } from '../lib/filtros/pe-grupo-uno-visual.ts'
import { rowMatchesPeTipoDiccionario, parsePeTipoSelected } from '../lib/filtros/filtro-tipo-pe-diccionario.ts'
import {
  CATALOG_SHELL_LATIDOS,
  shellLatidoClass,
} from '../lib/catalogoShellLatidos.ts'
import { resolvePeVisualBadges } from '../lib/catalogoPeVisual.tsx'
import { resolveCatalogShellVariant } from '../lib/catalogoComercial.ts'

const FUCSIA = 'catalog-card-casino-fucsia'
const ORO = 'catalog-card-casino-oro'

// CP promo — biblioteca caso
const cpPromo = { descp_caso: 'PROMOCIONAL', cadena_comercial: null, es_promo: false, es_liquidacion: false }
assert.ok(esCasoPromocional(cpPromo.descp_caso))
assert.ok(rowMatchesTipoGrupos(cpPromo, ['promo']))
const cpShell = resolveCatalogShellVariant({ esLiquidacion: false, esPromo: true, esPe: false })
assert.equal(cpShell, 'cp-promo')
assert.ok(shellLatidoClass(cpShell).includes(FUCSIA))

// PE promo — diccionario SDRM
const pePromo = { cadena_comercial: 'PROMOCIONAL', es_promo: true, es_liquidacion: false }
assert.ok(esPromoRow(pePromo))
assert.equal(cadenaPeCanonico(pePromo), 'PROMOCIONAL')
assert.ok(rowMatchesPeTipoDiccionario(pePromo, parsePeTipoSelected(['promo'])))
const peVis = resolvePeVisualBadges({ ...pePromo, origen_tipo: 'PRONTA_ENTREGA' })
assert.equal(peVis?.shellVariant, 'promo')
assert.ok(shellLatidoClass('promo').includes(FUCSIA))
assert.equal(shellLatidoClass('promo'), shellLatidoClass('cp-promo'))

// PE LIQ — oro distinto de promo fucsia
const peLiq = { cadena_comercial: 'LIQUIDACION', es_liquidacion: true, es_promo: false }
assert.ok(shellLatidoClass('liquidacion').includes(ORO))
assert.ok(!shellLatidoClass('liquidacion').includes(FUCSIA))
assert.notEqual(shellLatidoClass('promo'), shellLatidoClass('liquidacion'))

assert.equal(CATALOG_SHELL_LATIDOS.length, 7)
console.log('OK smoke latidos promo CP=PE fucsia · LIQ oro · matriz', CATALOG_SHELL_LATIDOS.length)
