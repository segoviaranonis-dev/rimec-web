import { supabase } from '../supabase'
import { calcularKpis, construirArbolPeControl, normalizarFilasPeMolecula } from './buildTree'
import type { ControlKpis, NodoControl, PeControlStockResponse, PeDetalleStockRow } from './types'

const PAGE_SIZE = 1000
const MAX_PAGES = 13

const PE_SELECT = `
  deposito_nombre, descp_marca, descp_grupo_estilo,
  linea_codigo, referencia_codigo, material_code, color_code,
  cantidad_pares, pares_vendidos, saldo_pares
`.replace(/\s+/g, ' ').trim()

type PeRawRow = {
  deposito_nombre: string | null
  descp_marca: string | null
  descp_grupo_estilo: string | null
  linea_codigo: string | null
  referencia_codigo: string | null
  material_code: string | null
  color_code: string | null
  cantidad_pares: number | null
  pares_vendidos: number | null
  saldo_pares: number | null
}

async function fetchPeStockRows(): Promise<PeRawRow[]> {
  const all: PeRawRow[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('v_stock_pe_rimec')
      .select(PE_SELECT)
      .order('det_id')
      .range(from, to)

    if (error) throw new Error(error.message)
    const batch = (data ?? []) as unknown as PeRawRow[]
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  return all
}

function norm(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function calcularKpisPe(filas: PeDetalleStockRow[]): ControlKpis {
  const base = calcularKpis(
    filas.map(f => ({
      pp_id: 0,
      pp_nro: f.deposito,
      pp_proforma: '',
      pp_eta: null,
      genero: '',
      marca: f.marca,
      estilo: f.estilo,
      linea: f.linea,
      referencia: f.referencia,
      material_code: f.material_code,
      descp_material: '',
      color_code: f.color_code,
      descp_color: '',
      grada: '',
      inicial: f.inicial,
      vendido: f.vendido,
      saldo: f.saldo,
    })),
  )
  return {
    ...base,
    pps: new Set(filas.map(f => f.deposito)).size,
  }
}

export async function fetchControlStockPe(opts: {
  depositos?: string[]
  marcas?: string[]
  estilos?: string[]
  soloSaldo?: boolean
}): Promise<PeControlStockResponse> {
  const raw = await fetchPeStockRows()
  const filas: PeDetalleStockRow[] = []

  for (const r of raw) {
    const vendido = Number(r.pares_vendidos) || 0
    const saldo = Number(r.saldo_pares) || 0
    const inicial = Number(r.cantidad_pares) || vendido + saldo
    const deposito = norm(r.deposito_nombre) || 'Sin depósito'
    const marca = norm(r.descp_marca) || '—'
    const estilo = norm(r.descp_grupo_estilo) || 'Sin estilo'

    if (opts.soloSaldo && saldo <= 0) continue
    if (opts.depositos?.length && !opts.depositos.includes(deposito)) continue
    if (opts.marcas?.length && !opts.marcas.includes(marca)) continue
    if (opts.estilos?.length && !opts.estilos.includes(estilo)) continue

    filas.push({
      deposito,
      marca,
      estilo,
      linea: norm(r.linea_codigo),
      referencia: norm(r.referencia_codigo),
      material_code: norm(r.material_code),
      color_code: norm(r.color_code),
      inicial,
      vendido,
      saldo,
    })
  }

  const filasNorm = normalizarFilasPeMolecula(filas)
  const depositos = [...new Set(filasNorm.map(f => f.deposito))].sort()
  const marcas = [...new Set(filasNorm.map(f => f.marca))].sort()
  const estilos = [...new Set(filasNorm.map(f => f.estilo))].sort()

  return {
    depositos,
    marcas,
    estilos,
    filas: filasNorm,
    kpis: calcularKpisPe(filasNorm),
    arbol: construirArbolPeControl(filasNorm),
  }
}
