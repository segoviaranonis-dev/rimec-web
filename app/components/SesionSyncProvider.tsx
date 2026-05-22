'use client'

/**
 * Sincroniza el store `useSesion` entre múltiples pestañas del navegador.
 *
 * Caso de uso:
 *   - El vendedor abre rimec-web en dos pestañas.
 *   - En la pestaña A elimina los ítems huérfanos del carrito o cierra la venta.
 *   - Zustand-persist escribe a localStorage; el navegador dispara el evento
 *     `storage` en TODAS las demás pestañas (no en la que escribió).
 *   - Este provider rehidrata el store en la pestaña pasiva para que muestre
 *     el estado actualizado y no se le permita confirmar un pedido con datos
 *     stale.
 *
 * Notas:
 *   - El evento `storage` no se dispara en la misma pestaña que hizo el
 *     `setItem`. Por eso solo necesitamos esto en pestañas pasivas.
 *   - Si `BroadcastChannel` estuviera disponible podríamos usarlo, pero
 *     `storage` ya cubre el caso y no requiere dependencias extra.
 */

import { useEffect } from 'react'
import { useSesion, STORAGE_KEY_SESION } from '@/store/sesionVenta'

export function SesionSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage) return
      if (event.key !== STORAGE_KEY_SESION) return
      // Recargar el estado desde localStorage en esta pestaña.
      // Zustand-persist expone `rehydrate()` en `useSesion.persist`.
      void useSesion.persist.rehydrate()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return <>{children}</>
}
