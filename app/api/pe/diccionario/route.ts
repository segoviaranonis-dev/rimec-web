import { NextResponse } from 'next/server'
import { fetchPeDiccionarioMap } from '@/lib/peDiccionario'

/** GET — cadenas PE + % D1 (MIG-180) para badge catálogo */
export async function GET() {
  const map = await fetchPeDiccionarioMap()
  const cadenas = [...map.values()].sort((a, b) => a.cadena_pe.localeCompare(b.cadena_pe))
  return NextResponse.json({ cadenas, fetchedAt: Date.now() })
}
