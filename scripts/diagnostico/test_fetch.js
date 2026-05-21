const fs = require('fs')
const path = require('path')

const cookie = 'rimec_session=eyJhbGciOiJIUzI1NiJ9.eyJpZF91c3VhcmlvIjoxLCJuYW1lIjoiSEVDVE9SIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzc5MzY5NjM3LCJleHAiOjE3Nzk5NzQ0Mzd9.3N6vFgw7pCoXvFKCNJh0vKVEI2Lh9YpQ-5rHrscSGGQ'

async function fetchUrl(url, filename) {
  try {
    const res = await fetch(url, {
      headers: {
        'Cookie': cookie
      }
    })
    const html = await res.text()
    const dest = path.join('C:\\Users\\hecto\\.gemini\\antigravity\\scratch', filename)
    fs.writeFileSync(dest, html, 'utf8')
    console.log(`Successfully fetched ${url} -> ${dest}`)
  } catch (err) {
    console.error(`Error fetching ${url}:`, err)
  }
}

async function main() {
  await fetchUrl('http://localhost:3001/', 'home.html')
  await fetchUrl('http://localhost:3001/?marca_id=4', 'home_marca4.html')
  await fetchUrl('http://localhost:3001/estadisticas', 'estadisticas.html')
  await fetchUrl('http://localhost:3001/pedidos', 'pedidos.html')
  await fetchUrl('http://localhost:3001/carrito', 'carrito.html')
}

main()
