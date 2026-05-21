const fs = require('fs')
const path = require('path')

const cookie = 'rimec_session=eyJhbGciOiJIUzI1NiJ9.eyJpZF91c3VhcmlvIjoxLCJuYW1lIjoiSEVDVE9SIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzc5MzY3MTczLCJleHAiOjE3Nzk5NzE5NzN9.iNAueqSFGTaxfCL_O5JfL_aA8E719F7uBTeQz_xOzYo'

async function main() {
  try {
    const res = await fetch('http://localhost:3001/api/estadisticas', {
      headers: {
        'Cookie': cookie
      }
    })
    const data = await res.json()
    const dest = 'C:\\Users\\hecto\\.gemini\\antigravity\\scratch\\estadisticas.json'
    fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf8')
    console.log(`Successfully fetched /api/estadisticas -> ${dest}`)
    console.log('KPIs:', data.kpis)
    console.log('Available PPs count:', data.pps?.length)
    console.log('Available Generos:', data.generos)
    console.log('Available Marcas count:', data.marcas?.length)
    console.log('Available Estilos count:', data.estilos?.length)
    console.log('Arbol root count:', data.arbol?.length)
  } catch (err) {
    console.error('Error fetching /api/estadisticas:', err)
  }
}

main()
