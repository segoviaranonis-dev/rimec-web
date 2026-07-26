/**
 * Smoke cascada Molécula — reglas puras (sin import TS).
 * Uso: node scripts/smoke_cascada_molecula.mjs
 */

function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function toggleFamiliaKey(list, key) {
  return list.includes(key) ? list.filter((x) => x !== key) : [...list, key]
}

function cascadaEstilo(grupo_estilo_id) {
  return {
    grupo_estilo_id,
    linea_ids: [],
    material_familias: [],
    color_familias: [],
    colores: [],
  }
}

function cascadaLinea(linea_ids) {
  return {
    linea_ids,
    material_familias: [],
    color_familias: [],
    colores: [],
  }
}

function cascadaMaterial(material_familias) {
  return {
    material_familias,
    color_familias: [],
    colores: [],
  }
}

function cascadaColor(color_familias) {
  return { color_familias }
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg)
    process.exit(1)
  }
}

const e = cascadaEstilo('12')
assert(e.grupo_estilo_id === '12', 'estilo id')
assert(e.linea_ids.length === 0, 'estilo limpia lineas')
assert(e.material_familias.length === 0, 'estilo limpia material')
assert(e.color_familias.length === 0, 'estilo limpia color')

const l = cascadaLinea([1, 2])
assert(l.linea_ids.join(',') === '1,2', 'lineas')
assert(l.material_familias.length === 0, 'linea limpia material')

const m = cascadaMaterial(['napa'])
assert(m.material_familias[0] === 'napa', 'material')
assert(m.color_familias.length === 0, 'material limpia color')

const c = cascadaColor(['negro'])
assert(c.color_familias[0] === 'negro', 'color hoja')
assert(c.linea_ids === undefined, 'color no toca linea')

assert(toggleId([1], 2).join(',') === '1,2', 'toggleId add')
assert(toggleFamiliaKey(['a'], 'b').includes('b'), 'toggleFamilia')

console.log('OK cascada molecula')
