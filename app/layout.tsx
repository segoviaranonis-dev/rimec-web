import type { Metadata } from 'next'
import { Urbanist, Playfair_Display } from 'next/font/google'
import './globals.css'
import Header from './components/Header'
import { getFiltros } from '@/lib/filtros'

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const filtrosData = await getFiltros()
  
  return (
    <html lang="es" className={`${urbanist.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased" style={{ backgroundColor: '#FAFAFA', color: '#0F172A' }}>
        <Header data={filtrosData?.header || {
          mujeres: { label: 'Damas', lineas: [], marcas: [], estilos: [], tipos: [] },
          ninas:   { label: 'Niñas', lineas: [], marcas: [], estilos: [], tipos: [] },
          ninos:   { label: 'Niños', lineas: [], marcas: [], estilos: [], tipos: [] },
          hombres: { label: 'Caballeros', lineas: [], marcas: [], estilos: [], tipos: [] }
        }} />
        <main className="max-w-[1440px] mx-auto px-4 md:px-8 lg:px-12 py-8 md:py-12">
          {children}
        </main>
      </body>
    </html>
  )
}
