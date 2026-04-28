const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/.next/server/app/admin/model';

function traverseAndSearch(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      traverseAndSearch(fullPath);
    } else if (fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const regex = /sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+\/=]+)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const json = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
        const idx = json.sources.findIndex(s => s.includes('anticipos/historial/page.tsx'));
        if (idx !== -1 && json.sourcesContent[idx]) {
           const outFile = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/app/admin/model/anticipos/historial/page.tsx';
           fs.writeFileSync(outFile, json.sourcesContent[idx]);
           console.log('RECOVERED:', outFile);
           return;
        }
      }
    }
  }
}

try {
  traverseAndSearch('C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/.next/server/app');
} catch(e) {
  console.log(e.message);
}
