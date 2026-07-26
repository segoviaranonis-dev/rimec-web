/**
 * Post-confirm PE → sync Logística OK si el PP ya tiene bandera + Fecha de entrega Real.
 * RPC MIG-181: sync_logistica_pp_if_bandera
 */
type SbRpc = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: number,
      ) => PromiseLike<{ data: Array<{ pp_id: number | null; nro_factura: string | null }> | null; error: { message: string } | null }>
    }
  }
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

export async function syncLogisticaOkPostConfirmarPe(
  sb: SbRpc,
  pedidoId: number,
): Promise<{ ppIds: number[]; results: unknown[] }> {
  if (!pedidoId || pedidoId <= 0) return { ppIds: [], results: [] }

  const { data: fis, error } = await sb
    .from('factura_interna')
    .select('pp_id, nro_factura')
    .eq('pedido_id', pedidoId)

  if (error) {
    console.warn('[confirmar] sync logística list FI:', error.message)
    return { ppIds: [], results: [] }
  }

  const ppIds = [
    ...new Set(
      (fis ?? [])
        .filter((f) => {
          const nro = String(f.nro_factura ?? '')
          const pp = Number(f.pp_id)
          return /^PE-/i.test(nro) && Number.isFinite(pp) && pp > 0
        })
        .map((f) => Number(f.pp_id)),
    ),
  ]

  const results: unknown[] = []
  for (const ppId of ppIds) {
    const { data, error: rpcErr } = await sb.rpc('sync_logistica_pp_if_bandera', {
      p_pp_id: ppId,
    })
    if (rpcErr) {
      console.warn(`[confirmar] sync_logistica_pp_if_bandera(${ppId}):`, rpcErr.message)
      results.push({ pp_id: ppId, ok: false, error: rpcErr.message })
    } else {
      results.push(data)
    }
  }

  return { ppIds, results }
}
