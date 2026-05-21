const fs = require('fs')
const path = require('path')

function inspect(filePath, label) {
  const content = fs.readFileSync(filePath, 'utf8')
  console.log(`=== INSPECTING ${label} ===`)
  
  // check if it has the title or headings
  const titleMatch = content.match(/<title>([^<]+)<\/title>/i)
  console.log('Title:', titleMatch ? titleMatch[1] : 'Not found')
  
  // check if there's any obvious error or if they load the normal UI
  const hasError = content.includes('Internal Server Error') || content.includes('Application error')
  console.log('Has Error:', hasError)
  
  // Search for typical content in these pages
  const textCheck = ['carrito', 'pedido', 'vacío', 'comprar', 'historial', 'cliente', 'HECTOR']
  for (const word of textCheck) {
    if (content.toLowerCase().includes(word.toLowerCase())) {
      console.log(`Contains word "${word}": Yes`)
    } else {
      console.log(`Contains word "${word}": No`)
    }
  }

  // Snippet check
  const bodyIdx = content.indexOf('<body')
  if (bodyIdx !== -1) {
    // print some text from body
    console.log('Body snippet (100-300 chars):', content.substring(bodyIdx + 50, bodyIdx + 450).replace(/<[^>]+>/g, ' ').trim().substring(0, 300))
  }
}

inspect('C:\\Users\\hecto\\.gemini\\antigravity\\scratch\\pedidos.html', 'Pedidos Page')
inspect('C:\\Users\\hecto\\.gemini\\antigravity\\scratch\\carrito.html', 'Carrito Page')
