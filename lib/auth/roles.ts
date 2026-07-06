/**
 * OT-514: Roles permitidos en RIMEC Web (Vercel)
 * Fuente verdad: usuario_v2.categoria
 * Referencia: ventas_por_mes_rimec-main/core/auth.py
 */

export const CATEGORIAS_PERMITIDAS = ['VENDEDOR', 'ADMIN'] as const

/**
 * Normaliza categorías legadas (mismo role_map que Nexus)
 * DIRECTOR, GERENTE, DIOS → ADMIN para efectos de acceso catálogo
 */
export function normalizarCategoria(categoria: string): string {
  const cat = categoria.toUpperCase().trim()

  if (
    cat === 'DIRECTOR' ||
    cat === 'GERENTE' ||
    cat === 'DIOS' ||
    cat === 'ROOT' ||
    cat === 'ADMINISTRADOR'
  ) {
    return 'ADMIN'
  }

  return cat
}

export function esCategoriaPermitida(categoria: string): boolean {
  const catNorm = normalizarCategoria(categoria)
  return CATEGORIAS_PERMITIDAS.includes(catNorm as any)
}

/** Matriz holding: BAZZAR (rol 2) + VENDEDOR → sin RIMEC Web */
export function puedeAccederRimecWeb(rolId: number, categoria: string): boolean {
  const catNorm = normalizarCategoria(categoria)
  if (rolId === 2 && catNorm === 'VENDEDOR') return false
  return esCategoriaPermitida(categoria)
}

export type RolePermitido = typeof CATEGORIAS_PERMITIDAS[number]
