'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

const RIMEC_BLUE   = '#0F172A'
const RIMEC_ACCENT = '#0EA5E9'

// ── Mega panel Mujeres ──────────────────────────────────────────────────────
function MegaMujeres({ data }: { data: HeaderData['mujeres'] }) {
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 w-[640px] bg-white border-t border-gray-200 shadow-xl z-50 py-8 px-10">
      <div className="grid grid-cols-3 gap-8">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-gray-400 mb-4">{data.label}</p>
          <Link href="/" className="block text-sm text-gray-800 hover:text-[#0EA5E9] transition-colors py-1 font-medium">Ver todo</Link>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">Marcas</p>
          <ul className="space-y-2.5">
            {data.marcas.map(m => (
              <li key={m.id}>
                <Link href={`/?marca_id=${m.id}`} className="text-sm text-gray-800 hover:text-[#0EA5E9] transition-colors">{cap(m.label)}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">Estilos</p>
          <ul className="space-y-2.5">
            {data.estilos.slice(0, 9).map(e => (
              <li key={e.id}>
                <Link href={`/?grupo_estilo_id=${e.id}`} className="text-sm text-gray-800 hover:text-[#0EA5E9] transition-colors">{e.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function MegaNinas({ data }: { data: HeaderData['ninas'] }) {
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 w-[640px] bg-white border-t border-gray-200 shadow-xl z-50 py-8 px-10">
      <div className="grid grid-cols-3 gap-8">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-gray-400 mb-4">{data.label}</p>
          <Link href="/" className="block text-sm text-gray-800 hover:text-[#0EA5E9] transition-colors py-1 font-medium">Ver todo</Link>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">Marcas</p>
          <ul className="space-y-2.5">
            {data.marcas.map(m => (
              <li key={m.id}>
                <Link href={`/?marca_id=${m.id}`} className="text-sm text-gray-800 hover:text-[#0EA5E9] transition-colors">{cap(m.label)}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">Estilos</p>
          <ul className="space-y-2.5">
            {data.estilos.slice(0, 9).map(e => (
              <li key={e.id}>
                <Link href={`/?grupo_estilo_id=${e.id}`} className="text-sm text-gray-800 hover:text-[#0EA5E9] transition-colors">{e.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Mega panel Niños ────────────────────────────────────────────────────────
function MegaNinos({ data }: { data: HeaderData['ninos'] }) {
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 w-[640px] bg-white border-t border-gray-200 shadow-xl z-50 py-8 px-10">
      <div className="grid grid-cols-3 gap-8">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-gray-400 mb-4">{data.label}</p>
          <Link href="/" className="block text-sm font-medium text-gray-800 hover:text-[#0EA5E9] transition-colors py-1">Ver todo</Link>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">Marcas</p>
          <ul className="space-y-2.5">
            {data.marcas.slice(0, 9).map(m => (
              <li key={m.id}>
                <Link href={`/?marca_id=${m.id}`} className="text-sm text-gray-800 hover:text-[#0EA5E9] transition-colors">{cap(m.label)}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">Estilos</p>
          <ul className="space-y-2.5">
            {data.estilos.slice(0, 9).map(e => (
              <li key={e.id}>
                <Link href={`/?grupo_estilo_id=${e.id}`} className="text-sm text-gray-800 hover:text-[#0EA5E9] transition-colors">{e.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Mega panel Hombres ──────────────────────────────────────────────────────
function MegaHombres({ data }: { data: HeaderData['hombres'] }) {
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 w-[640px] bg-white border-t border-gray-200 shadow-xl z-50 py-8 px-10">
      <div className="grid grid-cols-3 gap-8">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-gray-400 mb-4">{data.label}</p>
          <Link href="/" className="block text-sm font-medium text-gray-800 hover:text-[#0EA5E9] transition-colors py-1">Ver todo</Link>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">Marcas</p>
          <ul className="space-y-2.5">
            {data.marcas.map(m => (
              <li key={m.id}>
                <Link href={`/?marca_id=${m.id}`} className="text-sm text-gray-800 hover:text-[#0EA5E9] transition-colors">{cap(m.label)}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">Estilos</p>
          <ul className="space-y-2.5">
            {data.estilos.slice(0, 9).map(e => (
              <li key={e.id}>
                <Link href={`/?grupo_estilo_id=${e.id}`} className="text-sm text-gray-800 hover:text-[#0EA5E9] transition-colors">{e.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Search bar estético ──────────────────────────────────────────────────────
function SearchBar() {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const router            = useRouter()

  const close = () => { setOpen(false); setQuery('') }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Buscar"
        className="p-2 text-gray-800 hover:text-[#0EA5E9] transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
        </svg>
      </button>
    )
  }

  return (
    <div className="relative">
      <form onSubmit={e => { e.preventDefault(); if (query.trim()) { router.push(`/?buscar=${encodeURIComponent(query.trim())}`); close() } }}
        className="flex items-center gap-2">
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar marca, línea..."
          className="w-56 text-sm border-0 border-b outline-none px-1 py-1 bg-transparent placeholder-gray-400"
          style={{ borderColor: RIMEC_BLUE }}
        />
        <button type="button" onClick={close}
          className="text-gray-400 hover:text-black transition-colors text-xl leading-none">×</button>
      </form>
    </div>
  )
}

// ── Header principal ────────────────────────────────────────────────────────
type MegaKey = 'mujeres' | 'ninas' | 'ninos' | 'hombres' | null

export default function Header({ data }: { data: HeaderData }) {
  const [open, setOpen]   = useState<MegaKey>(null)
  const closeTimer        = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enter = (key: MegaKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(key)
  }
  const leave = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 120)
  }

  const navItem = (key: MegaKey, label: string) => (
    <div className="relative" onMouseEnter={() => enter(key)} onMouseLeave={leave}>
      <button className={`text-sm tracking-wide transition-colors py-5 border-b-2 ${
        open === key ? 'border-[#0EA5E9] text-[#0EA5E9]' : 'border-transparent text-gray-800 hover:text-[#0EA5E9]'
      }`}>
        {label}
      </button>
      {open === 'mujeres' && key === 'mujeres' && <MegaMujeres data={data.mujeres} />}
      {open === 'ninas'   && key === 'ninas'   && <MegaNinas   data={data.ninas} />}
      {open === 'ninos'   && key === 'ninos'   && <MegaNinos   data={data.ninos} />}
      {open === 'hombres' && key === 'hombres' && <MegaHombres data={data.hombres} />}
    </div>
  )

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 transition-all duration-300">

      {/* Announcement bar */}
      <div className="text-white text-center text-[10px] tracking-[0.2em] uppercase py-2.5 px-4 font-medium"
           style={{ backgroundColor: RIMEC_BLUE }}>
        Stock en tránsito y depósito &nbsp;·&nbsp; Catálogo mayorista
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-16">

          {/* Brand serif */}
          <div className="flex items-center gap-4">
            <Link href="/" className="font-serif text-2xl font-bold tracking-wide select-none"
                  style={{ color: RIMEC_BLUE }}>
              RIMEC
            </Link>
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] px-2 py-0.5 rounded-sm"
                  style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
              Mayorista
            </span>
          </div>

          {/* Nav — mega menus */}
          <nav className="hidden md:flex items-center gap-8">
            {navItem('mujeres', data.mujeres.label)}
            {navItem('ninas',   data.ninas.label)}
            {navItem('ninos',   data.ninos.label)}
            {navItem('hombres', data.hombres.label)}
            <Link href="/"
              className="text-sm tracking-wide text-gray-800 hover:text-[#0EA5E9] transition-colors py-5 border-b-2 border-transparent">
              Catálogo
            </Link>
          </nav>

          {/* Acciones */}
          <div className="flex items-center gap-4 text-sm font-medium tracking-wide text-gray-800">
            <SearchBar />
            <Link href="/carrito" className="hover:text-[#0EA5E9] transition-colors ml-2">
              Carrito
            </Link>
            <Link href="/pedidos" className="hover:text-[#0EA5E9] transition-colors">
              Pedidos
            </Link>
            <Link
              href="/estadisticas"
              className="hover:text-[#0EA5E9] transition-colors font-semibold text-[#0EA5E9]"
            >
              Estadísticas
            </Link>
          </div>
        </div>
      </div>

      {/* Overlay cierra mega menus */}
      {open && (
        <div className="fixed inset-0 top-[calc(4rem+2.25rem)] z-30"
          onMouseEnter={leave} onClick={() => setOpen(null)} />
      )}
    </header>
  )
}
