import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  COLORES_ESTANDAR_DEFAULT,
  rowToColorEstandar,
  type ColorEstandar,
} from '@/lib/pilares/colores-estandar'

export const dynamic = 'force-dynamic'

const PROVEEDOR_RIMEC = 654

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('color_tono_estandar')
      .select('etiqueta, hex, aliases, orden, uso_count')
      .eq('proveedor_id', PROVEEDOR_RIMEC)
      .order('orden', { ascending: true })

    let catalogo: ColorEstandar[] = COLORES_ESTANDAR_DEFAULT
    if (!error && data?.length) {
      catalogo = data.map(rowToColorEstandar)
    }

    return NextResponse.json({ catalogo })
  } catch (err) {
    console.error('[catalogo/tonos]', err)
    return NextResponse.json({ catalogo: COLORES_ESTANDAR_DEFAULT })
  }
}
