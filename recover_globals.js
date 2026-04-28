const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/.next/server/app/admin/model';
const fullPath = path.join(baseDir, 'dashboard/page.js');
const content = fs.readFileSync(fullPath, 'utf8');
const regex = /sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+\/=]+)/g;

let match;
while ((match = regex.exec(content)) !== null) {
  const base64Data = match[1];
  const buffer = Buffer.from(base64Data, 'base64');
  const json = JSON.parse(buffer.toString('utf8'));
  
  for (let i = 0; i < json.sources.length; i++) {
    const sourceName = json.sources[i];
    if (sourceName.includes('globals.css') || sourceName.includes('anticipos/historial/page.tsx')) {
       const sourceCode = json.sourcesContent[i];
       const cleanName = sourceName.includes('globals') ? 'app/globals.css' : 'app/admin/model/anticipos/historial/page.tsx';
       const outFile = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/' + cleanName;
       
       // Only write if it's not empty, or append a log
       if(sourceCode) {
           fs.writeFileSync(outFile, sourceCode);
           console.log('RECOVERED:', outFile);
       }
    }
  }
}
