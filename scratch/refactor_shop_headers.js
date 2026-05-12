const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    const dirent = fs.statSync(dirFile);
    if (dirent.isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.tsx')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const dirs = ['app/admin/shop'].map(d => path.join(__dirname, '..', d));
const files = dirs.flatMap(d => walkSync(d));

let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Regex to match the shop header blocks:
  // <div className="flex items-center justify-between mb-6"> ... </div>
  const shopHeaderRegex = /<div className="flex items-center justify-between mb-6">([\s\S]*?)<\/div>\s*<(div|table)/g;

  content = content.replace(shopHeaderRegex, (match, inner, nextTag) => {
     // Extract title
     const titleMatch = inner.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
     let titleStr = 'Shop';
     let emoji = '';
     if (titleMatch) {
         const h1Content = titleMatch[1];
         // extract emoji from <span class="text-2xl">📦</span> Products
         const spanMatch = h1Content.match(/<span[^>]*>(.*?)<\/span>\s*(.*)/);
         if (spanMatch) {
             emoji = spanMatch[1].trim();
             titleStr = spanMatch[2].trim();
         } else {
             titleStr = h1Content.replace(/<[^>]+>/g, '').trim();
         }
     }

     // Extract subtitle
     const subtitleMatch = inner.match(/<p[^>]*>([^<]+)<\/p>/);
     let subtitleStr = subtitleMatch ? `\n          subtitle="${subtitleMatch[1].trim()}"` : '';

     // Extract button
     let actionStr = '';
     const buttonMatch = inner.match(/<button[\s\S]*?<\/button>/);
     if (buttonMatch) {
         let btn = buttonMatch[0].replace('className="', 'className="btn-apple-primary ');
         actionStr = `\n          actions={\n            ${btn}\n          }`;
     }

     return `<PageHeader
          title="${titleStr}"${subtitleStr}
          glow="admin"
          icon={<span className="text-2xl drop-shadow-md">${emoji || '🛒'}</span>}${actionStr}
        />\n        <${nextTag}`;
  });

  if (content !== originalContent) {
    if (!content.includes('PageHeader')) {
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfLine = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, endOfLine + 1) + 'import PageHeader from "@/components/ui/PageHeader";\n' + content.slice(endOfLine + 1);
      } else {
        content = 'import PageHeader from "@/components/ui/PageHeader";\n' + content;
      }
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log('Modified Shop:', file);
    modifiedCount++;
  }
}

console.log('Finished refactoring Shop headers:', modifiedCount);
