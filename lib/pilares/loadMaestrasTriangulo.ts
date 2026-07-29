/**
 * Carga Estilo + Género desde maestros pilares (FK), no desde distinct de stock.
 */
import { supabase } from '@/lib/supabase'
import {
  ESTILOS_POR_TIPO_V2,
  normMaestraLabel,
  tipoV2IdFromRamoTipo,
} from '@/lib/pilares/estilosPorTipoV2'

export type MaestraTrianguloItem = { id: number; label: string }

export type MaestrasTrianguloCatalogo = {
  tipo_v2_id: 1 | 2
  estilos: MaestraTrianguloItem[]
  generos: { codigo: string; label: string }[]
}

export async function loadMaestrasTrianguloCatalogo(
  ramoTipo: string | null | undefined,
): Promise<MaestrasTrianguloCatalogo | null> {
  const tipo = tipoV2IdFromRamoTipo(ramoTipo)
  if (tipo == null) return null

  const labels = ESTILOS_POR_TIPO_V2[tipo].map((l) => normMaestraLabel(l))

  const [estilosRes, generosRes] = await Promise.all([
    supabase
      .from('grupo_estilo_v2')
      .select('id_grupo_estilo, descp_grupo_estilo')
      .order('descp_grupo_estilo'),
    supabase.from('genero').select('id, codigo, descripcion').order('descripcion'),
  ])

  if (estilosRes.error) {
    console.error('[maestrasTriangulo] estilos', estilosRes.error.message)
    return null
  }
  if (generosRes.error) {
    console.error('[maestrasTriangulo] generos', generosRes.error.message)
    return null
  }

  const allow = new Set(labels)
  const estilos = (estilosRes.data ?? [])
    .map((r) => ({
      id: Number(r.id_grupo_estilo),
      label: String(r.descp_grupo_estilo ?? '').trim(),
    }))
    .filter((e) => Number.isFinite(e.id) && e.label && allow.has(normMaestraLabel(e.label)))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

  const generos = (generosRes.data ?? [])
    .map((r) => {
      const label = String(r.descripcion ?? '').trim()
      const codigo = String(r.codigo ?? label)
        .trim()
        .toUpperCase()
      return { codigo, label: label || codigo }
    })
    .filter((g) => g.codigo && g.label)

  return { tipo_v2_id: tipo, estilos, generos }
}
