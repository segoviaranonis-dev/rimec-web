/**
 * @deprecated MIG-187 / 2026-07-27 — PROHIBIDO llamar desde confirmar carrito.
 * Puente PE → Logística OK = solo post-Confirmar FI en Report (syncLogisticaTrasConfirmarFi).
 * Este módulo se conserva solo como referencia histórica del bug Graciela (pre-sync RESERVADA).
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

/** @deprecated No invocar — ver CHUSAR 2.3.1.28.12 */
export async function syncLogisticaOkPostConfirmarPe(
  _sb: SbRpc,
  _pedidoId: number,
): Promise<{ ppIds: number[]; results: unknown[] }> {
  console.warn(
    "[DEPRECATED] syncLogisticaOkPostConfirmarPe — usar Aprobaciones confirmar FI → Logística OK",
  );
  return { ppIds: [], results: [] };
}
