/** Normaliza payload carrito antes de RPC — PE sin pp_id FK · marca_id 0 → null. */
export function sanitizeConfirmarPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const p = payload as { lotes?: unknown };
  if (!Array.isArray(p.lotes)) return payload;

  return {
    ...p,
    lotes: p.lotes.map(sanitizeLote),
  };
}

function sanitizeMarcaId(factura: Record<string, unknown>): Record<string, unknown> {
  const raw = factura.marca_id;
  if (raw === null || raw === undefined || raw === "") {
    return { ...factura, marca_id: null };
  }
  const marcaId = Number(raw);
  if (!Number.isFinite(marcaId) || marcaId <= 0) {
    return { ...factura, marca_id: null };
  }
  return factura;
}

function sanitizeLote(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const lote = raw as Record<string, unknown>;
  const ppId = Number(lote.pp_id);
  const isPe = lote.origen_pe === true || (Number.isFinite(ppId) && ppId < 0);

  const facturas = Array.isArray(lote.facturas)
    ? lote.facturas.map((f) => {
        if (!f || typeof f !== "object" || Array.isArray(f)) return f;
        return sanitizeMarcaId(f as Record<string, unknown>);
      })
    : lote.facturas;

  const base = isPe ? { ...lote, origen_pe: true, pp_id: null } : lote;
  return { ...base, facturas };
}
