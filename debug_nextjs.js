const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/.next/server/app/admin/model';
const content = fs.readFileSync(path.join(baseDir, 'dashboard/page.js'), 'utf8');
const regex = /sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+\/=]+)/g;

let match;
while ((match = regex.exec(content)) !== null) {
  const base64Data = match[1];
  const buffer = Buffer.from(base64Data, 'base64');
  const json = JSON.parse(buffer.toString('utf8'));
  console.log('Sources found in map:', json.sources.slice(0, 10)); // just print first 10
}
