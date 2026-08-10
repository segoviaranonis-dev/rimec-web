/**
 * Simulación ley FI PE: comisión ≠ descuento comercial.
 * npx tsx rimec-web/scripts/_smoke_descuento_comercial_vs_comision.ts
 */
import assert from 'node:assert/strict'
import {
  esDescuentoSoloComisionDiccionario,
  resolverDescuentosFiPe,
} from '../lib/resolverDescuentosFiPe'

function ok(label: string) {
  console.log('PASS', label)
}

// --- detección comisión ---
assert.equal(esDescuentoSoloComisionDiccionario([2, 0, 0, 0]), true)
assert.equal(esDescuentoSoloComisionDiccionario([4, 0, 0, 0]), true)
assert.equal(esDescuentoSoloComisionDiccionario([17, 0, 0, 0]), false)
assert.equal(esDescuentoSoloComisionDiccionario([2, 5, 0, 0]), false)
assert.equal(esDescuentoSoloComisionDiccionario([0, 0, 0, 0]), false)
ok('detección solo-comisión 2%/4%')

// --- caso Director: PE-LIQ LPN con 2% pegado (comisión) + dictado 17% ---
{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 1,
    descuentosPrevios: [2, 0, 0, 0],
    dictadoComercialPct: 17,
    preAutorizado: false,
  })
  assert.deepEqual(out, [17, 0, 0, 0])
  ok('PE-LIQ LPN: 2% comisión → 17% comercial')
}

// --- PE-NORMAL LPN con 4% comisión + sin dictado → limpiar (no es Desc. comercial) ---
{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 1,
    descuentosPrevios: [4, 0, 0, 0],
    dictadoComercialPct: null,
    preAutorizado: false,
  })
  assert.deepEqual(out, [0, 0, 0, 0])
  ok('PE-NORMAL sin dictado: limpia 4% comisión (no inventa Desc.)')
}

// --- PE-NORMAL con dictado (hipotético 7.5) pisando 4% ---
{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 1,
    descuentosPrevios: [4, 0, 0, 0],
    dictadoComercialPct: 7.5,
    preAutorizado: false,
  })
  assert.deepEqual(out, [7.5, 0, 0, 0])
  ok('PE-NORMAL: 4% comisión → 7.5% dictado')
}

// --- LPC03: D1=10 + D2=dictado ---
{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 3,
    descuentosPrevios: [2, 0, 0, 0],
    dictadoComercialPct: 17,
    preAutorizado: false,
  })
  assert.deepEqual(out, [10, 17, 0, 0])
  ok('LPC03: 10% + 17% dictado')
}

{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 3,
    descuentosPrevios: [10, 2, 0, 0],
    dictadoComercialPct: 17,
    preAutorizado: false,
  })
  assert.deepEqual(out, [10, 17, 0, 0])
  ok('LPC03: D2 comisión 2 → D2 17')
}

{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 3,
    descuentosPrevios: [5, 20, 0, 0],
    dictadoComercialPct: 17,
    preAutorizado: false,
  })
  assert.deepEqual(out, [5, 20, 0, 0])
  ok('LPC03: usuario controla D1=5 (no impone 10)')
}

{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 3,
    descuentosPrevios: [0, 0, 0, 0],
    dictadoComercialPct: null,
    preAutorizado: false,
  })
  assert.deepEqual(out, [10, 0, 0, 0])
  ok('LPC03 sin dictado: solo 10%')
}

// --- pre_autorizado: no tocar solo comisión; sí bloquea comercial real ---
{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 1,
    descuentosPrevios: [2, 0, 0, 0],
    dictadoComercialPct: 17,
    preAutorizado: true,
  })
  assert.deepEqual(out, [17, 0, 0, 0])
  ok('pre_autorizado + solo comisión 2% → re-sync dictado 17%')
}

{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 1,
    descuentosPrevios: [15, 0, 0, 0],
    dictadoComercialPct: 17,
    preAutorizado: true,
  })
  assert.deepEqual(out, [15, 0, 0, 0])
  ok('pre_autorizado + 15% comercial → conserva edición vendedor')
}

{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 3,
    descuentosPrevios: [0, 0, 0, 0],
    dictadoComercialPct: 25,
    preAutorizado: true,
  })
  assert.deepEqual(out, [10, 25, 0, 0])
  ok('pre_autorizado + ceros congelados → aplica LPC03+dictado')
}

// --- PROMOCIONAL + LPC03: sin Grado 1 +10 % ---
{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 3,
    descuentosPrevios: [0, 0, 0, 0],
    dictadoComercialPct: 17,
    esPromocional: true,
  })
  assert.deepEqual(out, [17, 0, 0, 0])
  ok('PROMO+LPC03: solo dictado 17 (sin 10%)')
}

{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 3,
    descuentosPrevios: [10, 25, 0, 0],
    dictadoComercialPct: 25,
    esPromocional: true,
  })
  assert.deepEqual(out, [25, 0, 0, 0])
  ok('PROMO+LPC03: limpia D1=10 residual → solo dictado')
}

{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 3,
    descuentosPrevios: [0, 0, 0, 0],
    dictadoComercialPct: null,
    esPromocional: true,
  })
  assert.deepEqual(out, [0, 0, 0, 0])
  ok('PROMO+LPC03 sin dictado: sin 10% automático')
}

// --- vacío + dictado ---
{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 1,
    descuentosPrevios: [0, 0, 0, 0],
    dictadoComercialPct: 17,
    preAutorizado: false,
  })
  assert.deepEqual(out, [17, 0, 0, 0])
  ok('vacío + dictado 17')
}

// --- ya comercial 17: no pisar ---
{
  const out = resolverDescuentosFiPe({
    listaPrecioId: 1,
    descuentosPrevios: [17, 0, 0, 0],
    dictadoComercialPct: 17,
    preAutorizado: false,
  })
  assert.deepEqual(out, [17, 0, 0, 0])
  ok('ya 17% comercial estable')
}

console.log('\nALL SMOKE PASS · comisión ≠ comercial · LPC03 10+dictado')
