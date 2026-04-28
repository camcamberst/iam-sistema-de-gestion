const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'components/chat');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace console.log(, console.warn(, console.error( with void(
  content = content.replace(/console\.(log|warn|error|info|debug)\s*\(/g, 'void(');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned ${file}`);
}
