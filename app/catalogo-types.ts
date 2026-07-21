/** Tipos compartidos catálogo — sin importar page.tsx (evita SSR pesado). */
export interface StockRow {
  det_id: number
  pp_id: number | null
  pp_nro: string
  proforma: string
  quincena_arribo_id: number | null
  quincena_desc: string | null
  /** Nº preventa Carlos · pedido_proveedor.nro_pedido_externo */
  numero_preventa?: string | null
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
  /** PE: texto importación `34(1 2 3 3 2 1)39` cuando grades_json es null. */
  grada?: string | null
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
  imagen_color_excel?: string | null
  proveedor_importacion_id?: number | null
  tipo_v2_id?: number | null
  origen_tipo?: string | null
  deposito_id?: number | null
  deposito_nombre?: string | null
  clasificacion_stock_id?: number | null
  pp_estado?: string | null
  genero_codigo?: string | null
  descp_genero?: string | null
  ramo_tipo?: string | null
  cod_grupo?: string | null
  sdrm_marca?: string | null
  sdrm_tipo0?: string | null
  sdrm_tipo1?: string | null
  sdrm_tipo2?: string | null
  es_liquidacion?: boolean | null
  es_promo?: boolean | null
  cadena_comercial?: string | null
}
