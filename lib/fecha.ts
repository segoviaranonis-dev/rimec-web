export function formatearQuincena(fechaISO: string | null | undefined): string {
  if (!fechaISO) return 'Sin fecha confirmada'
  const fecha = new Date(fechaISO)
  if (isNaN(fecha.getTime())) return 'Sin fecha confirmada'
  const dia  = fecha.getDate()
  const mes  = fecha.toLocaleString('es-PY', { month: 'long' })
  const anio = fecha.getFullYear()
  const mesCapital = mes.charAt(0).toUpperCase() + mes.slice(1)
  const quincena = dia <= 15 ? '1ra Quincena' : '2da Quincena'
  return `${quincena} de ${mesCapital} ${anio}`
}
