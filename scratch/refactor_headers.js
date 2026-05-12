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
      if (dirFile.endsWith('.tsx') && !dirFile.includes('model')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const dirs = ['app/admin', 'app/superadmin'].map(d => path.join(__dirname, '..', d));
const files = dirs.flatMap(d => walkSync(d));

let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Regex to match the manual glass-header block
  const headerRegex = /<div className="mb-8 sm:mb-12">\s*<div className="relative">\s*<div className="absolute inset-0 bg-gradient-to-r from-blue-600\/10 to-indigo-600\/10 rounded-(xl|3xl) blur-xl"><\/div>\s*<div className="glass-header p-4 sm:p-6 relative">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;

  content = content.replace(headerRegex, (match, inner) => {
     // Extract title
     const titleMatch = inner.match(/<h1[^>]*>([^<]+)<\/h1>/);
     const title = titleMatch ? titleMatch[1].trim() : 'Título';

     // Extract subtitle
     const subtitleMatch = inner.match(/<p[^>]*>([^<]+)<\/p>/);
     let subtitleStr = '';
     if (subtitleMatch && !subtitleMatch[1].includes('{user.name}')) {
        subtitleStr = `\n          subtitle="${subtitleMatch[1].trim()}"`;
     } else if (inner.includes('{user &&')) {
        // Just generic subtitle if it has dynamic user name
        subtitleStr = `\n          subtitle={user ? \`Bienvenido, \${user.name} · Rol: \${String(user.role).replace('_',' ')}\${user.role !== 'super_admin' && user.groups.length > 0 ? \` · Grupos: \${user.groups.join(', ')}\` : ''}\` : undefined}`;
     }

     // Extract svg icon
     const svgMatch = inner.match(/<svg[^>]*>[\s\S]*?<\/svg>/);
     let svgStr = '';
     if (svgMatch) {
         let cleanSvg = svgMatch[0].replace(/className="[^"]*"/, 'className="w-5 h-5 sm:w-6 sm:h-6 text-white"');
         svgStr = `\n          icon={\n            ${cleanSvg}\n          }`;
     }

     // Extract button/action
     // Find the button that is a direct child of the flex container or after the title div
     let actionStr = '';
     const buttonMatch = inner.match(/<button[\s\S]*?<\/button>/);
     if (buttonMatch) {
         // Check if this button is NOT the one inside an SVG (none are)
         actionStr = `\n          actions={\n            ${buttonMatch[0].replace('className="w-full btn-apple-primary"', 'className="w-full btn-apple-primary flex items-center justify-center gap-2"')}\n          }`;
     }

     return `<PageHeader
          title="${title}"${subtitleStr}
          glow="admin"${svgStr}${actionStr}
        />`;
  });

  if (content !== originalContent) {
    // Need to add import PageHeader if it doesn't exist
    if (!content.includes('PageHeader')) {
      // Find the last import
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfLine = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, endOfLine + 1) + 'import PageHeader from "@/components/ui/PageHeader";\n' + content.slice(endOfLine + 1);
      } else {
        content = 'import PageHeader from "@/components/ui/PageHeader";\n' + content;
      }
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log('Modified:', file);
    modifiedCount++;
  }
}

console.log('Finished refactoring headers:', modifiedCount);
