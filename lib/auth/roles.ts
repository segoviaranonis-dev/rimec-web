/**
 * OT-514: Roles permitidos en RIMEC Web (Vercel)
 * Fuente verdad: usuario_v2.categoria
 * Referencia: ventas_por_mes_rimec-main/core/auth.py
 */

export const CATEGORIAS_PERMITIDAS = ['VENDEDOR', 'ADMIN'] as const

/**
 * Normaliza categorías legadas (mismo role_map que Nexus)
 * DIRECTOR, GERENTE → ADMIN para efectos de acceso
 */
export function normalizarCategoria(categoria: string): string {
  const cat = categoria.toUpperCase().trim()

  // role_map de Nexus
  if (cat === 'DIRECTOR' || cat === 'GERENTE') {
    return 'ADMIN'
  }

  return cat
}

export function esCategoriaPermitida(categoria: string): boolean {
  const catNorm = normalizarCategoria(categoria)
  return CATEGORIAS_PERMITIDAS.includes(catNorm as any)
}

export type RolePermitido = typeof CATEGORIAS_PERMITIDAS[number]
