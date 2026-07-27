'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import NotificationBell from '@/components/NotificationBell'

/** Legacy prop — layout sigue pasando forma vacía; mega menú género eliminado. */
export interface FilterItem {
  id: number
  label: string
}

export interface HeaderData {
  mujeres: { label: string; lineas: FilterItem[]; marcas: FilterItem[]; estilos: FilterItem[]; tipos: FilterItem[] }
  ninas:   { label: string; lineas: FilterItem[]; marcas: FilterItem[]; estilos: FilterItem[]; tipos: FilterItem[] }
  ninos:   { label: string; lineas: FilterItem[]; marcas: FilterItem[]; estilos: FilterItem[]; tipos: FilterItem[] }
  hombres: { label: string; lineas: FilterItem[]; marcas: FilterItem[]; estilos: FilterItem[]; tipos: FilterItem[] }
}

const RIMEC_BLUE = '#0F172A'

function SearchBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="p-2 text-gray-800 hover:text-[#0EA5E9] transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim()) {
            router.push(`/?buscar=${encodeURIComponent(query.trim())}`)
            close()
          }
        }}
        className="flex items-center gap-2"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar marca, línea..."
          className="w-56 text-sm border-0 border-b outline-none px-1 py-1 bg-transparent placeholder-gray-400"
          style={{ borderColor: RIMEC_BLUE }}
        />
        <button
          type="button"
          onClick={close}
          className="text-gray-400 hover:text-black transition-colors text-xl leading-none"
        >
          ×
        </button>
      </form>
    </div>
  )
}

export default function Header({ data: _data }: { data: HeaderData }) {
  return (
    <Suspense
      fallback={
        <HeaderShell
          esPe={false}
          esCp={false}
          esEstadisticas={false}
          hrefCp="/?origen_tipo=CP&ramo_tipo=CALZADO"
          hrefPe="/?origen_tipo=PRONTA_ENTREGA&ramo_tipo=CALZADO"
        />
      }
    >
      <HeaderInner />
    </Suspense>
  )
}

/** Params de filtro que deben sobrevivir al cambiar Compra previa ↔ Pronta entrega (proceso de venta). */
const FILTROS_COMPARTIDOS_URL = [
  'marca_id',
  'grupo_estilo_id',
  'marca_ids',
  'grupo_estilo_ids',
  'linea_ids',
  'tipo_ids',
  'genero_codigo',
  'tonos',
  'sin_tono',
  'buscar',
  'tipo_grupos',
  'material_familias',
  'color_familias',
  'colores',
  'precio_tope',
  'precio_min',
  'precio_max',
  'lista_precio_id',
] as const

function hrefOrigen(
  origen: 'CP' | 'PRONTA_ENTREGA',
  searchParams: URLSearchParams,
  pathname: string,
): string {
  const next = new URLSearchParams()
  const enCatalogo = pathname === '/' || pathname === ''
  if (enCatalogo) {
    for (const k of FILTROS_COMPARTIDOS_URL) {
      const v = searchParams.get(k)
      if (v) next.set(k, v)
    }
  }
  next.set('origen_tipo', origen)
  const ramo = searchParams.get('ramo_tipo')
  if (ramo) next.set('ramo_tipo', ramo)
  else next.set('ramo_tipo', 'CALZADO')
  if (origen === 'CP') {
    const q = searchParams.get('quincenas')
    if (q) next.set('quincenas', q)
  } else {
    const dep = searchParams.get('deposito_codigo')
    if (dep) next.set('deposito_codigo', dep)
  }
  return `/?${next.toString()}`
}

function HeaderInner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const origen = (searchParams.get('origen_tipo') ?? 'TODOS').toUpperCase()
  const esPe = origen.includes('PRONTA')
  const esCp = origen === 'CP' || origen.includes('COMPRA')
  const esEstadisticas = pathname === '/estadisticas'
  const hrefCp = hrefOrigen('CP', searchParams, pathname)
  const hrefPe = hrefOrigen('PRONTA_ENTREGA', searchParams, pathname)
  return (
    <HeaderShell
      esPe={esPe}
      esCp={esCp}
      esEstadisticas={esEstadisticas}
      hrefCp={hrefCp}
      hrefPe={hrefPe}
    />
  )
}

function IconEstadisticas({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  )
}

function OrigenNavBtn({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold tracking-wide transition-all ${
        active
          ? 'bg-[#0F172A] text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-700 hover:border-[#0EA5E9] hover:text-[#0EA5E9]'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  )
}

function HeaderShell({
  esPe,
  esCp,
  esEstadisticas,
  hrefCp,
  hrefPe,
}: {
  esPe: boolean
  esCp: boolean
  esEstadisticas: boolean
  hrefCp: string
  hrefPe: string
}) {
  const [navOculto, setNavOculto] = useState(false)
  const [user, setUser] = useState<{ name: string; categoria: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    try {
      setNavOculto(localStorage.getItem('rimec-web-header-collapsed') === '1')
    } catch {
      /* ignore */
    }
  }, [])

  const toggleNav = () => {
    setNavOculto((prev) => {
      const next = !prev
      try {
        localStorage.setItem('rimec-web-header-collapsed', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user || null)
      })
      .catch(() => setUser(null))
  }, [])

  async function handleLogout() {
    try {
      setUser(null)
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch {
      setUser(null)
      router.push('/login')
    }
  }

  const aviso = esPe
    ? 'Pronta entrega · stock en depósito local'
    : esCp
      ? 'Compra previa · stock en tránsito y depósito'
      : 'Stock en tránsito y depósito · Catálogo mayorista'

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
      {!navOculto && (
        <>
          <div
            className="text-white text-center text-[10px] tracking-[0.2em] uppercase py-2.5 px-4 font-medium"
            style={{ backgroundColor: RIMEC_BLUE }}
          >
            {aviso}
          </div>

          <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
            <div className="flex items-center justify-between h-16 gap-4">
              <div className="flex items-center gap-4 shrink-0">
                <Link
                  href="/"
                  className="font-serif text-2xl font-bold tracking-wide select-none"
                  style={{ color: RIMEC_BLUE }}
                >
                  RIMEC
                </Link>
                <span
                  className="text-[10px] font-medium uppercase tracking-[0.15em] px-2 py-0.5 rounded-sm"
                  style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
                >
                  Mayorista
                </span>
              </div>

              {/* Sustituye Damas/Niñas/Niños/Caballeros/Catálogo — conserva filtros al vender */}
              <nav className="flex flex-1 items-center justify-center gap-2 sm:gap-3" aria-label="Origen de stock">
                <OrigenNavBtn href={hrefCp} active={esCp}>
                  🚢 Compra previa
                </OrigenNavBtn>
                <OrigenNavBtn href={hrefPe} active={esPe}>
                  📦 Pronta entrega
                </OrigenNavBtn>
              </nav>

              <div className="flex items-center gap-4 text-sm font-medium tracking-wide text-gray-800 shrink-0">
                <button
                  type="button"
                  onClick={toggleNav}
                  className="hidden md:inline text-xs text-gray-500 hover:text-[#0EA5E9]"
                  aria-expanded={!navOculto}
                >
                  Ocultar menú ▲
                </button>
                <SearchBar />
                {user && <NotificationBell />}
                <Link href="/carrito" className="hover:text-[#0EA5E9] transition-colors ml-2">
                  Carrito
                </Link>
                <Link href="/pedidos" className="hover:text-[#0EA5E9] transition-colors">
                  Pedidos
                </Link>
                {user && (
                  <Link href="/mis-facturas" className="hover:text-[#0EA5E9] transition-colors">
                    Mis Facturas
                  </Link>
                )}
                <Link
                  href="/estadisticas"
                  title="Estadísticas"
                  aria-label="Estadísticas"
                  aria-current={esEstadisticas ? 'page' : undefined}
                  className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-colors ${
                    esEstadisticas
                      ? 'text-[#0EA5E9] bg-sky-50 ring-1 ring-sky-200'
                      : 'text-gray-600 hover:text-[#0EA5E9] hover:bg-slate-50'
                  }`}
                >
                  <IconEstadisticas />
                </Link>
                {user && (
                  <>
                    <span className="text-xs text-gray-600 border-l pl-4 border-gray-300">{user.name}</span>
                    <button onClick={handleLogout} className="text-xs hover:text-red-600 transition-colors">
                      Cerrar sesión
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {navOculto && (
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 flex items-center justify-between h-11 gap-3">
          <Link href="/" className="font-serif text-lg font-bold" style={{ color: RIMEC_BLUE }}>
            RIMEC
          </Link>
          <nav className="flex items-center gap-2" aria-label="Origen de stock">
            <OrigenNavBtn href={hrefCp} active={esCp}>
              🚢 Compra previa
            </OrigenNavBtn>
            <OrigenNavBtn href={hrefPe} active={esPe}>
              📦 Pronta entrega
            </OrigenNavBtn>
          </nav>
          <div className="flex items-center gap-3 text-xs font-medium">
            <button
              type="button"
              onClick={toggleNav}
              className="text-xs font-semibold text-gray-600 hover:text-[#0EA5E9] px-3 py-1 rounded-lg border border-gray-200"
            >
              Mostrar menú ▼
            </button>
            <Link href="/carrito" className="hover:text-[#0EA5E9]">
              Carrito
            </Link>
            {user && (
              <button type="button" onClick={handleLogout} className="hover:text-red-600">
                Salir
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
