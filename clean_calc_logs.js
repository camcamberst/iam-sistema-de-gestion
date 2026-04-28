const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'components');
const targetFiles = ['ModelCalculator.tsx', 'AdminModelCalculator.tsx', 'ModelCalculatorNew.tsx'];

for (const file of targetFiles) {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');

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
    
    const logStatement = content.substring(startIndex, endIndex);
    
    // Si contiene [CALCULATOR], lo removemos
    if (logStatement.includes('[CALCULATOR]')) {
       newContent += '(function(){})()'; 
    } else {
       newContent += logStatement;
       if (content[endIndex] === ';') newContent += ';';
    }
    
    lastIndex = endCutIndex;
  }
  
  newContent += content.substring(lastIndex);
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`Cleaned ${file}`);
}
