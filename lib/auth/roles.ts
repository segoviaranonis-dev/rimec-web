/**
 * OT-514: Roles permitidos en RIMEC Web (Vercel)
 * Fuente verdad: usuario_v2.categoria
 * Referencia: ventas_por_mes_rimec-main/core/auth.py
 *
 * Scope catálogo (ramos) — ver lib/auth/catalogoScopeUsuario.ts:
 * · Calzado 654: vendedores RIMEC (ATI, LILI, …) → 638 PROHIBIDO
 * · Confecciones 638: PATRICIA · DARIO → 654 PROHIBIDO
 * · Libre: DIOS / ADMIN (salvo Patricia) / Bazzar
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

/** VENDEDOR y ADMIN (RIMEC + Bazzar tienda compradora) → catálogo mayorista. IVO = ADMIN Bazzar gerencial. */
export function puedeAccederRimecWeb(_rolId: number, categoria: string): boolean {
  return esCategoriaPermitida(categoria)
}

export type RolePermitido = typeof CATEGORIAS_PERMITIDAS[number]
