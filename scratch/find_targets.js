const fs = require('fs');
const path = require('path');

function searchFiles(dir, regex) {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(searchFiles(fullPath, regex));
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (regex.test(content)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const regex = /glass-card[\s\S]{1,200}bg-gradient-to-br[\s\S]{1,100}<h[234]/;

const adminFiles = searchFiles('app/admin', regex);
const superadminFiles = searchFiles('app/superadmin', regex);
const componentFiles = searchFiles('components', regex);

const allFiles = [...adminFiles, ...superadminFiles, ...componentFiles];
console.log('Found ' + allFiles.length + ' files:');
console.log(allFiles.join('\n'));
