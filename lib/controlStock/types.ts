export interface DetalleStockRow {
  pp_id: number
  pp_nro: string
  pp_proforma: string
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
