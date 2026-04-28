const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'components/chat');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Regex to remove console.log / error / warn safely without breaking arrow functions
  // We match console.log( ... );?
  // We will replace it with `void 0;`
  
  const regex = /console\.(log|warn|error)\([^)]*\[(?:ChatWidget|IndividualChat|MainChatWindow|CHAT-LAUNCHER)\][^)]*\);?/g;
  
  content = content.replace(regex, 'void 0;');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned ${file}`);
}
