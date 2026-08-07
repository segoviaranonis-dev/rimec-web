'use client'

/**
 * SesionSyncProvider — MIG-080 multidispositivo.
 *
 * Responsabilidades:
 *  1. Al montar la app, resuelve el vendedor desde /api/auth/me y lo guarda en el store.
 *  2. Lee el carrito persistido en BD (GET /api/carrito/sesion) y poblá la cache local.
 *  3. Mantiene una suscripción Realtime a carrito_sesion + carrito_item filtrada
 *     por id_usuario. Cuando otra pestaña/dispositivo modifica algo, recargamos.
 *  4. Limpia la suscripción al desmontar.
 */

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { scheduleCarritoHydrate, useSesion } from '@/store/sesionVenta'

interface MeResponse {
  user: { id_usuario: number; name: string; role: string } | null
}

export function SesionSyncProvider({ children }: { children: React.ReactNode }) {
  const cargarDesdeBD = useSesion((s) => s.cargarDesdeBD)
  const setVendedor = useSesion((s) => s.setVendedor)
  const vendedor = useSesion((s) => s.vendedor)

  const userIdRef = useRef<number | null>(null)

  // 1. Resolver vendedor + 2. carga inicial del carrito.
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        if (!res.ok) return
        const data = (await res.json()) as MeResponse
        if (cancelado || !data.user) return
        userIdRef.current = data.user.id_usuario
        setVendedor({
          id_vendedor: data.user.id_usuario,
          descp_vendedor: data.user.name,
        })
        await cargarDesdeBD()
        // Bitácora presencia (refuerzo del /me)
        void fetch('/api/auth/bitacora-presencia', {
          method: 'POST',
          credentials: 'include',
        })
      } catch (err) {
        console.warn('[SesionSyncProvider] init falló:', err)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [cargarDesdeBD, setVendedor])

  // Heartbeat Bitácora cada 3 min mientras hay vendedor
  useEffect(() => {
    const id = vendedor?.id_vendedor
    if (!id) return
    const t = setInterval(() => {
      void fetch('/api/auth/bitacora-presencia', {
        method: 'POST',
        credentials: 'include',
      })
    }, 3 * 60 * 1000)
    return () => clearInterval(t)
  }, [vendedor?.id_vendedor])

  // 3. Realtime: re-sincroniza ante cambios (debounce — anti-race GET vacío).
  useEffect(() => {
    const id = vendedor?.id_vendedor
    if (!id) return

    const refrescar = () => { scheduleCarritoHydrate() }

    const channel = supabase
      .channel(`carrito-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carrito_sesion', filter: `id_usuario=eq.${id}` },
        refrescar,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carrito_item', filter: `id_usuario=eq.${id}` },
        refrescar,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [vendedor?.id_vendedor])

  return <>{children}</>
}
