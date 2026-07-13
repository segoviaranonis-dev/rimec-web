import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Urbanist, Playfair_Display } from 'next/font/google'
import './globals.css'
import Header from './components/Header'
import { CatalogWarmProvider } from './components/CatalogWarmProvider'
import { SesionSyncProvider } from './components/SesionSyncProvider'

const urbanist = Urbanist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
})

export const metadata: Metadata = {
  title: 'RIMEC — Catálogo Mayorista',
  description: 'Stock en tránsito y depósito para vendedores',
}

const EMPTY_HEADER = {
  mujeres: { label: 'Damas', lineas: [], marcas: [], estilos: [], tipos: [] },
  ninas:   { label: 'Niñas', lineas: [], marcas: [], estilos: [], tipos: [] },
  ninos:   { label: 'Niños', lineas: [], marcas: [], estilos: [], tipos: [] },
  hombres: { label: 'Caballeros', lineas: [], marcas: [], estilos: [], tipos: [] },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get('x-url-path') ?? ''
  const isAuthShell = path === '/login' || path === '/acceso-denegado'

  return (
    <html lang="es" className={`${urbanist.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased" style={{ backgroundColor: '#FAFAFA', color: '#0F172A' }}>
        <SesionSyncProvider>
          {!isAuthShell && (
            <>
              <CatalogWarmProvider />
              <Header data={EMPTY_HEADER} />
            </>
          )}
          {isAuthShell ? (
            children
          ) : (
            <main className="max-w-[1440px] mx-auto px-4 md:px-8 lg:px-12 py-3 md:py-5">
              {children}
            </main>
          )}
        </SesionSyncProvider>
      </body>
    </html>
  )
}
