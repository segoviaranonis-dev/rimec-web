const fs = require('fs')

function getHeadings(filePath, label) {
  const content = fs.readFileSync(filePath, 'utf8')
  console.log(`=== HEADINGS FOR ${label} ===`)
  
  // Extract all h1, h2, h3 tags
  const tags = content.match(/<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi)
  if (tags) {
    tags.forEach(t => console.log(t.replace(/<[^>]+>/g, ' ').trim()))
  } else {
    console.log('No headings found')
  }

  // Also search for buttons or text paragraphs that indicate page state
  const paragraphs = content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi)
  if (paragraphs) {
    console.log('--- Paragraphs (first 5) ---')
    paragraphs.slice(0, 5).forEach(p => console.log('- ' + p.replace(/<[^>]+>/g, ' ').trim()))
  }
}

getHeadings('C:\\Users\\hecto\\.gemini\\antigravity\\scratch\\pedidos.html', 'Pedidos')
getHeadings('C:\\Users\\hecto\\.gemini\\antigravity\\scratch\\carrito.html', 'Carrito')
