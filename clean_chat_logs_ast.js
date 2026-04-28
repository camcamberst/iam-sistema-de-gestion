const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'components/chat');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // We find matches of console.(log|warn|error|info|debug)
  const regex = /console\.(log|warn|error|info|debug)\s*\(/g;
  let match;
  let newContent = '';
  let lastIndex = 0;

  while ((match = regex.exec(content)) !== null) {
    const startIndex = match.index;
    const openParenIndex = startIndex + match[0].length - 1;
    let parensCount = 1;
    let i = openParenIndex + 1;
    let inString = false;
    let stringChar = '';

    while (i < content.length && parensCount > 0) {
      const char = content[i];
      if (!inString) {
        if (char === "'" || char === '"' || char === '`') {
          inString = true;
          stringChar = char;
        } else if (char === '(') {
          parensCount++;
        } else if (char === ')') {
          parensCount--;
        }
      } else {
        if (char === stringChar && content[i-1] !== '\\') {
          inString = false;
        }
      }
      i++;
    }

    const endIndex = i;
    
    let endCutIndex = endIndex;
    if (content[endIndex] === ';') {
      endCutIndex = endIndex + 1;
    }

    newContent += content.substring(lastIndex, startIndex);
    // Usar una IIFE vacía elimina todos los errores de sintaxis y de TS (ej. unused expressions)
    newContent += '(function(){})()'; 
    lastIndex = endCutIndex;
  }
  
  newContent += content.substring(lastIndex);
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`Cleaned ${file}`);
}
