const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'components/chat');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Regex para encontrar y comentar console.log, warn, error que empiecen con emojis en el log o no
  // Como es riesgoso romper bloques multilínea, vamos a usar una regex más simple
  // Solo reemplazaremos console.log(...) cuando todo está en la misma línea
  // o si es de una sola línea
  const regex = /console\.(log|error|warn)\([^;]+?\);?/g;
  
  content = content.replace(regex, '/* log removed */');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned ${file}`);
}
