/** Extrae campos PE → Logística OK del payload de confirmar (MIG-175). */
export function extraerLogisticaPePayload(payload: unknown): {
  observacion: string | null
  fecha_entrega_cliente: string | null
} {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { observacion: null, fecha_entrega_cliente: null }
  }
  const p = payload as Record<string, unknown>
  const obs = typeof p.observacion === 'string' ? p.observacion.trim() : ''
  const fechaRaw =
    typeof p.fecha_entrega_cliente === 'string' ? p.fecha_entrega_cliente.trim().slice(0, 10) : ''
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) ? fechaRaw : null
  return {
    observacion: obs.length > 0 ? obs.slice(0, 2000) : null,
    fecha_entrega_cliente: fecha,
  }
}

type SupabaseAdminLike = {
  from: (table: string) => {
    update: (values: Record<string, string | null>) => {
      eq: (
        col: string,
        val: number,
      ) => PromiseLike<{ error: { message: string } | null }>
    }
  }
}

/** Persiste observación + fecha en pedido y FIs tras confirmar (MIG-175). */
export async function persistirLogisticaPePostConfirmar(
  sb: SupabaseAdminLike,
  pedidoId: number,
  input: { observacion: string | null; fecha_entrega_cliente: string | null },
): Promise<void> {
  if (!pedidoId || (!input.observacion && !input.fecha_entrega_cliente)) return

  const patch: Record<string, string | null> = {}
  if (input.observacion) patch.observacion = input.observacion
  if (input.fecha_entrega_cliente) patch.fecha_entrega_cliente = input.fecha_entrega_cliente
  if (Object.keys(patch).length === 0) return

  const { error: pedErr } = await sb.from('pedido_venta_rimec').update(patch).eq('id', pedidoId)
  if (pedErr) {
    console.warn('[confirmar] MIG-175 pedido_venta_rimec:', pedErr.message)
  }

  const { error: fiErr } = await sb.from('factura_interna').update(patch).eq('pedido_id', pedidoId)
  if (fiErr) {
    console.warn('[confirmar] MIG-175 factura_interna:', fiErr.message)
  }
}
