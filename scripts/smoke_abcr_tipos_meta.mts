#!/usr/bin/env npx tsx
import { mergePeAbcrTipo1Items } from '../lib/filtros/pe-abcr-tipo1'
import { mergeTiposCatalogoTodos, normalizeFilterItems } from '../lib/catalogoFilters'

const peRaw = [
  { id: 2, label: 'ABIERTO' },
  { id: 3, label: 'ACT ROPAS' },
  { id: 4, label: 'MEDIAS' },
]
const cpRaw = [{ id: 2, label: 'CP-OTRO' }]

const merged = mergeTiposCatalogoTodos(cpRaw, peRaw, 'CALZADO')
const normalized = normalizeFilterItems(merged)

console.log('mergeTiposCatalogoTodos:', merged.map((t) => `${t.id}:${t.label}`).join(' | '))
console.log('normalizeFilterItems:', normalized.map((t) => `${t.id}:${t.label}`).join(' | '))
const labels = normalized.map((t) => t.label)
const need = ['CARTERAS', 'ANTEOJOS', 'MEDIAS', 'ABIERTO', 'ACT ROPAS']
const missing = need.filter((l) => !labels.includes(l))
console.log(missing.length ? `FAIL missing: ${missing.join(', ')}` : 'OK all AB-CR labels present')
console.log('synthetic ids:', normalized.filter((t) => t.id < 0).map((t) => t.id).join(','))
