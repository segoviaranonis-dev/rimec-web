import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RIMEC — Catálogo Mayorista',
  description: 'Stock en tránsito y depósito para vendedores',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ backgroundColor: '#FFFFFF', color: '#1E293B' }}>
        <header style={{ backgroundColor: '#FFFFFF', borderBottom: '2px solid #E2E8F0' }}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="/" className="text-3xl font-black tracking-tight" style={{ color: '#1E40AF' }}>
                RIMEC
              </a>
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                    style={{ backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                Mayorista
              </span>
            </div>
            <nav className="flex items-center gap-8 text-base font-semibold" style={{ color: '#64748B' }}>
              <a href="/"        className="hover:text-blue-700 transition-colors">Catálogo</a>
              <a href="/carrito" className="hover:text-blue-700 transition-colors">Carrito</a>
              <a href="/pedidos" className="hover:text-blue-700 transition-colors">Pedidos</a>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
