const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
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

const adminDir = path.join(__dirname, '..', 'app', 'admin');
const superadminDir = path.join(__dirname, '..', 'app', 'superadmin');

const files = [
  ...walkSync(adminDir),
  ...walkSync(superadminDir)
];

let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Broad replacement for any div with bg-white/70 or 80 and backdrop-blur-sm and rounded-xl/2xl
  content = content.replace(/className="[^"]*bg-white\/(80|70)[^"]*backdrop-blur-sm[^"]*rounded-[a-z]+[^"]*"/g, (match) => {
    if (match.includes('p-4 sm:p-6') || match.includes('p-6') || match.includes('p-4')) {
       if (match.includes('shadow-lg')) {
          return 'className="glass-header p-4 sm:p-6 relative"';
       } else if (match.includes('p-6')) {
          return 'className="glass-card p-6"';
       }
    }
    return match;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Modified:', file);
    modifiedCount++;
  }
}

console.log('Finished catching remaining glass cards:', modifiedCount);
