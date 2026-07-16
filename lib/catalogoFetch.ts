/** Lee JSON de fetch con cuerpo vacío o HTML (redirect login). */
export async function readJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? 'Respuesta vacía del servidor'
        : `Error del servidor (${res.status})`,
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(
      res.ok
        ? 'Respuesta inválida del servidor'
        : `Error del servidor (${res.status})`,
    )
  }
}

export type TarjetasPageJson = {
  tarjetas?: unknown[]
  nextRowFrom?: number
  hasMore?: boolean
  excludeCardKeys?: string[]
  error?: string
}

/** POST cuando hay exclude (scroll) — evita URL demasiado larga. */
export async function requestTarjetasPage(opts: {
  filtersQuery: string
  filters: Record<string, unknown>
  fromRow: number
  limit: number
  exclude: string[]
}): Promise<TarjetasPageJson> {
  const usePost = opts.exclude.length > 0
  const url = `/api/catalogo/tarjetas?${opts.filtersQuery}`

  const res = usePost
    ? await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          row_from: opts.fromRow,
          limit: opts.limit,
          exclude: opts.exclude,
          filters: opts.filters,
        }),
      })
    : await fetch(
        `${url}&row_from=${opts.fromRow}&limit=${opts.limit}`,
        { credentials: 'same-origin' },
      )

  const json = await readJsonResponse<TarjetasPageJson>(res)
  if (!res.ok) throw new Error(json.error ?? 'Error cargando catálogo')
  return json
}
