export interface DetalleStockRow {
  pp_id: number
  pp_nro: string
  pp_proforma: string
  /** Dato duro arribo (YYYY-MM-DD) — orden Compra previa. */
  pp_eta: string | null
  genero: string
  marca: string
  estilo: string
  linea: string
  referencia: string
  material_code: string
  descp_material: string
  color_code: string
  descp_color: string
  grada: string
  inicial: number
  vendido: number
  saldo: number
}

export interface PpOption {
  id: number
  nro: string
  proforma: string
  estado: string
  eta: string | null
  /** Chip filtro: proforma + ETA (PP secundario). */
  label: string
}

export interface ControlKpis {
  inicial: number
  vendido: number
  saldo: number
  pct_vendido: number | null
  skus: number
  marcas: number
  pps: number
}

export type NivelControl = 1 | 2 | 3 | 4 | 5

export interface NodoControl {
  id: string
  nivel: NivelControl
  nombre: string
  /** Línea secundaria (ej. PP). */
  meta?: string
  /** Orden arribo (ISO date o vacío). */
  sortEta?: string
  count: number
  inicial: number
  vendido: number
  saldo: number
  hijos?: NodoControl[]
}

export interface ControlStockResponse {
  pps: PpOption[]
  generos: string[]
  marcas: string[]
  estilos: string[]
  filas: DetalleStockRow[]
  kpis: ControlKpis
  arbol: NodoControl[]
}

export interface PeDetalleStockRow {
  deposito: string
  marca: string
  estilo: string
  linea: string
  referencia: string
  material_code: string
  color_code: string
  inicial: number
  vendido: number
  saldo: number
}

export interface PeControlStockResponse {
  depositos: string[]
  marcas: string[]
  estilos: string[]
  filas: PeDetalleStockRow[]
  kpis: ControlKpis
  arbol: NodoControl[]
}

/** RIMEC Web · Compra previa — jamás PROGRAMADO (categoria_id = 3). */
export const CATEGORIA_PROGRAMADO_ID = 3
export const CATEGORIA_COMPRA_PREVIA_ID = 2
