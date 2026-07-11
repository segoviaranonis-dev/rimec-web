import { notFound } from 'next/navigation'
import { CatalogTarjetaDeposito } from '@/components/catalog/CatalogTarjetaDeposito'
import { PromoCasoBadge } from '@/components/catalog/PromoCasoBadge'

/**
 * Preview local — badge PROMO + política LPC03=LPN (solo dev).
 * http://localhost:3001/dev/promo-preview
 */
export default function PromoPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const ventaFooterDemo = (
    <>
      <span className="mb-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold leading-tight text-sky-700">
        1ra Quincena de Julio
      </span>
      <p className="mb-1 line-clamp-2 text-[10px] leading-snug text-slate-600">
        NP SUPREMA · BLANCO OFF 526
      </p>
      <p className="mb-2 font-mono text-[9px] font-bold text-slate-500">34(1-1-2-2-1-1)39</p>
      <div className="rounded-lg bg-slate-900 py-1.5 text-center text-[10px] font-bold text-white">
        Activar venta
      </div>
    </>
  )

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Preview · caso PROMOCIONAL</h1>
        <p className="mb-6 text-sm text-slate-600">
          Badge verde esperanza junto a marca · LPC03 muestra precio (= LPN). Solo local — no deploy.
        </p>

        <div className="mb-8 flex flex-wrap items-end gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Referencia · caso normal (LPC03 +12%)
            </p>
            <CatalogTarjetaDeposito
              marca="MODARE"
              stockPares={48}
              linea="7378"
              referencia="223"
              material="526"
              color="001"
              alt="MODARE 7378·223"
              precio={224600}
              ventaFooter={ventaFooterDemo}
            />
            <p className="mt-2 text-[11px] text-slate-500">Sin badge · Gs. 224.600 LPC03</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Caso PROMOCIONAL · LPC03 = LPN
            </p>
            <CatalogTarjetaDeposito
              marca="MODARE"
              esPromo
              stockPares={72}
              linea="7401"
              referencia="102"
              material="526"
              color="002"
              alt="MODARE 7401·102 PROMO"
              precio={198400}
              ventaFooter={ventaFooterDemo}
            />
            <p className="mt-2 text-[11px] text-emerald-800">
              Badge <PromoCasoBadge size="compact" className="mx-0.5 align-middle" /> · precio = LPN
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
          <h2 className="mb-2 text-sm font-bold text-emerald-900">Componente aislado</h2>
          <div className="flex flex-wrap items-center gap-3">
            <PromoCasoBadge size="compact" />
            <PromoCasoBadge size="md" />
            <span className="text-[10px] text-emerald-800">
              #ECFDF5 · borde #6EE7B7 · texto #047857
            </span>
          </div>
        </section>
      </div>
    </main>
  )
}
