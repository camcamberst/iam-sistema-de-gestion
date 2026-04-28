const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/.next/server/app/admin/model';
const files = ['dashboard/page.js', 'calculator/page.js', 'portafolio/page.js'];

files.forEach(file => {
  try {
    const fullPath = path.join(baseDir, file);
    if (!fs.existsSync(fullPath)) return;
    const content = fs.readFileSync(fullPath, 'utf8');
    const regex = /sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+\/=]+)/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
      const base64Data = match[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const json = JSON.parse(buffer.toString('utf8'));
      
      for (let i = 0; i < json.sources.length; i++) {
        const sourceName = json.sources[i];
        if (sourceName.includes('page.tsx')) {
          if (sourceName.includes(file.split('/')[0])) {
             const sourceCode = json.sourcesContent[i];
             const outFile = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/app/admin/model/' + file.replace('.js', '.tsx');
             fs.writeFileSync(outFile, sourceCode);
             console.log('RECOVERED:', outFile);
          }
        }
      }
    }
  } catch(e) {
    console.error(e.message);
  }
});
