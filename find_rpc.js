const fs = require('fs');
const path = require('path');

function walk(dir, results) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fullPath.includes('node_modules') || fullPath.includes('.next') || fullPath.includes('.git')) return;
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      walk(fullPath, results);
    } else {
      if (file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.py')) {
        results.push(fullPath);
      }
    }
  });
}

const files = [];
walk('c:/Users/hecto/Nexus_Core', files);

console.log(`Searching through ${files.length} files...`);
files.forEach(f => {
  try {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('confirmar_pedido_web')) {
      console.log(`Found in: ${f}`);
    }
  } catch (e) {}
});
