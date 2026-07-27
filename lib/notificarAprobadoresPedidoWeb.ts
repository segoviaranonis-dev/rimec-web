import type { SupabaseClient } from '@supabase/supabase-js'

/** Destinatarios designados — pedido Web → módulo Aprobaciones (Report). */
export const APROBADORES_PEDIDO_WEB = ['HECTOR', 'Guido', 'Veronica'] as const

export type NotificarAprobadoresInput = {
  pedidoId: number
  vendedorNombre?: string | null
  clienteNombre?: string | null
}

async function resolveUsuarioIds(
  sb: SupabaseClient,
  nombres: readonly string[],
): Promise<number[]> {
  const { data, error } = await sb.from('usuario_v2').select('id_usuario, descp_usuario')
  if (error) throw error
  const ids: number[] = []
  for (const nombre of nombres) {
    const row = (data ?? []).find(
      (u) =>
        String(u.descp_usuario ?? '')
          .trim()
          .toLowerCase() === nombre.toLowerCase(),
    )
    if (row?.id_usuario != null) ids.push(Number(row.id_usuario))
  }
  return [...new Set(ids)]
}

/**
 * Inserta alerta crítica en Report para HECTOR, Guido y Veronica.
 * Solo lectura en sesión Report — modal con deep link /aprobaciones.
 */
export async function notificarAprobadoresPedidoWeb(
  sb: SupabaseClient,
  input: NotificarAprobadoresInput,
): Promise<{ insertadas: number }> {
  const usuarioIds = await resolveUsuarioIds(sb, APROBADORES_PEDIDO_WEB)
  if (usuarioIds.length === 0) {
    console.warn('[notificarAprobadores] ningún destinatario encontrado en usuario_v2')
    return { insertadas: 0 }
  }

  const vendedor = input.vendedorNombre?.trim() || 'Vendedor Web'
  const cliente = input.clienteNombre?.trim()
  const detalleCliente = cliente ? ` · Cliente ${cliente}` : ''
  const titulo = 'Pedido Web pendiente de aprobación'
  const mensaje = `${vendedor} confirmó pedido #${input.pedidoId}${detalleCliente}. Revisá en Aprobaciones.`
  const deepLink = '/aprobaciones?tab=pendientes'

  const rows = usuarioIds.map((usuario_id) => ({
    usuario_id,
    tipo: 'APROBACION_PENDIENTE',
    titulo,
    mensaje,
    entidad_tipo: 'pedido_web',
    entidad_id: input.pedidoId,
    deep_link: deepLink,
    leida: false,
  }))

  const { error } = await sb.from('notificaciones').insert(rows)
  if (error) {
    console.error('[notificarAprobadores] insert error:', error)
    throw error
  }

  return { insertadas: rows.length }
}
