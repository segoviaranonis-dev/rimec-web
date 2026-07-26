/** Persiste Obs. Logística PE en hilo MIG-179 (Supabase admin). */
export async function appendObsLogisticaPeAFacturas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  pedidoId: number,
  input: {
    texto: string
    usuarioId: number
    usuarioNombre: string
  },
): Promise<void> {
  const texto = input.texto.trim().slice(0, 2000)
  if (!pedidoId || !texto) return

  const { data: fis, error: selErr } = await sb
    .from('factura_interna')
    .select('id')
    .eq('pedido_id', pedidoId)

  if (selErr) {
    console.warn('[confirmar] MIG-179 list FI:', selErr.message)
    return
  }
  if (!fis?.length) return

  const rows = fis.map((fi: { id: number }) => ({
    factura_interna_id: fi.id,
    origen: 'PE_WEB',
    usuario_id: input.usuarioId,
    usuario_nombre: input.usuarioNombre.slice(0, 120),
    texto,
  }))

  const { error: insErr } = await sb.from('logistica_observacion').insert(rows)
  if (insErr) {
    console.warn('[confirmar] MIG-179 insert obs:', insErr.message)
  }
}
