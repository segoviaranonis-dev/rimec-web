'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Notificacion {
  id: number
  tipo: string
  titulo: string
  mensaje: string
  leida: boolean
  created_at: string
}

export default function NotificationBell() {
  const [noLeidas, setNoLeidas] = useState(0)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    let activo = true

    async function cargar(signal: AbortSignal) {
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        const res = await fetch('/api/notificaciones?no_leidas=true', { signal })
        if (!activo) return
        if (res.ok) {
          const data = await res.json()
          setNotificaciones(data.notificaciones || [])
          setNoLeidas(data.total || 0)
        }
      } catch (error) {
        if (!activo || (error instanceof DOMException && error.name === 'AbortError')) return
        // Servidor caído / HMR — no spamear consola (polling reintenta solo)
      } finally {
        if (activo) setCargando(false)
      }
    }

    void cargar(ctrl.signal)
    const intervalo = setInterval(() => void cargar(ctrl.signal), 30000)
    const onVisible = () => {
      if (!document.hidden) void cargar(ctrl.signal)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      activo = false
      ctrl.abort()
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  async function cargarNotificaciones() {
    try {
      const res = await fetch('/api/notificaciones?no_leidas=true')
      if (res.ok) {
        const data = await res.json()
        setNotificaciones(data.notificaciones || [])
        setNoLeidas(data.total || 0)
      }
    } catch {
      // red caída — ignorar
    } finally {
      setCargando(false)
    }
  }

  async function marcarComoLeida(id: number) {
    try {
      await fetch(`/api/notificaciones/${id}`, { method: 'PATCH' })
      cargarNotificaciones()
    } catch (error) {
      console.error('Error marcando notificación:', error)
    }
  }

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setMostrarDropdown(!mostrarDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        aria-label="Notificaciones"
      >
        {/* Bell SVG */}
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge con contador */}
        {noLeidas > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {mostrarDropdown && (
        <>
          {/* Overlay para cerrar al hacer click afuera */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMostrarDropdown(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 z-20 w-80 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notificaciones</h3>
              {noLeidas > 0 && (
                <span className="text-xs text-gray-500">
                  {noLeidas} {noLeidas === 1 ? 'nueva' : 'nuevas'}
                </span>
              )}
            </div>

            {/* Lista de notificaciones */}
            <div className="divide-y divide-gray-100">
              {cargando ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  Cargando...
                </div>
              ) : notificaciones.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  No hay notificaciones nuevas
                </div>
              ) : (
                notificaciones.map((notif) => (
                  <div
                    key={notif.id}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      marcarComoLeida(notif.id)
                      setMostrarDropdown(false)
                    }}
                  >
                    <div className="flex items-start">
                      {/* Icono según tipo */}
                      <div className="flex-shrink-0">
                        {notif.tipo === 'FI_CONFIRMADA' && (
                          <span className="text-2xl">✅</span>
                        )}
                        {notif.tipo === 'FI_ANULADA' && (
                          <span className="text-2xl">❌</span>
                        )}
                      </div>

                      {/* Contenido */}
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {notif.titulo}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {notif.mensaje}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notif.created_at).toLocaleString('es-PY')}
                        </p>
                      </div>

                      {/* Punto de no leída */}
                      {!notif.leida && (
                        <div className="ml-2 flex-shrink-0">
                          <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer con link a página completa */}
            {notificaciones.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200">
                <Link
                  href="/mis-facturas"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => setMostrarDropdown(false)}
                >
                  Ver todas mis facturas →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
