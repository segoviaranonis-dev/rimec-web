/** Tipos compartidos catálogo — sin importar page.tsx (evita SSR pesado). */
export interface StockRow {
  det_id: number
  pp_id: number | null
  pp_nro: string
  proforma: string
  quincena_arribo_id: number | null
  quincena_desc: string | null
  marca_id: number
  descp_marca: string
  caso_id: number | null
  descp_caso: string | null
  linea_id: number
  linea_codigo: string
  referencia_id: number
  referencia_codigo: string
  nombre: string
  material_code: string
  descp_material: string
  color_code: string
  descp_color: string
  color_hex: string | null
  color_tono_canon?: unknown | null
  grades_json: Record<string, number> | null
  cantidad_cajas: number
  cantidad_pares: number
  pares_vendidos?: number
  saldo_pares?: number
  cajas_disponibles?: number
  pares_por_caja: number
  lpn: number | null
  lpc02: number | null
  lpc03: number | null
  lpc04: number | null
  grupo_estilo_id: number
  descp_grupo_estilo: string
  tipo_1_id: number
  descp_tipo_1: string | null
  imagen_url: string | null
  origen_tipo?: string | null
  deposito_id?: number | null
  deposito_nombre?: string | null
  clasificacion_stock_id?: number | null
  pp_estado?: string | null
  genero_codigo?: string | null
  descp_genero?: string | null
}
