const fs = require('fs')
const path = require('path')

function analyze(filePath, label) {
  const content = fs.readFileSync(filePath, 'utf8')
  console.log(`=== ANALYZING ${label} ===`)
  
  // Check for the diagnostic box
  const hasDiagBox = content.includes('Catálogo vacío — diagnóstico rápido')
  console.log('Has Diagnostic Box:', hasDiagBox)

  // Look for total models and pares inside FiltrosCatalogo
  // usually it renders text like: "X Modelos" or "Y Pares" or similar.
  // Let's do a search for models/pares
  const modelsMatch = content.match(/(\d+)\s+Modelos/i) || content.match(/Modelos:\s*<strong>(\d+)<\/strong>/i)
  const paresMatch = content.match(/(\d+)\s+Pares/i) || content.match(/Pares:\s*<strong>(\d+)<\/strong>/i)
  
  console.log('Detected Modelos:', modelsMatch ? modelsMatch[0] : 'Not found')
  console.log('Detected Pares:', paresMatch ? paresMatch[0] : 'Not found')
  
  // Let's print a small snippet around the first appearance of "Modelos" or similar text
  const idx = content.indexOf('Modelos')
  if (idx !== -1) {
    console.log('Snippet around Modelos:', content.substring(idx - 100, idx + 100))
  }
}

analyze('C:\\Users\\hecto\\.gemini\\antigravity\\scratch\\home.html', 'Local Catalog (/)')
analyze('C:\\Users\\hecto\\.gemini\\antigravity\\scratch\\home_marca4.html', 'Local Catalog with ?marca_id=4')
analyze('C:\\Users\\hecto\\.gemini\\antigravity\\scratch\\estadisticas.html', 'Local Estadísticas (/estadisticas)')
analyze('C:\\Users\\hecto\\.gemini\\antigravity\\scratch\\pedidos.html', 'Local Pedidos (/pedidos)')
analyze('C:\\Users\\hecto\\.gemini\\antigravity\\scratch\\carrito.html', 'Local Carrito (/carrito)')
