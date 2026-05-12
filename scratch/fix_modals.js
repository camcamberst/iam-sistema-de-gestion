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
      if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const dirs = ['app/admin', 'app/superadmin', 'app/gestor', 'components'].map(d => path.join(__dirname, '..', d));
const files = dirs.flatMap(d => walkSync(d));

let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace modal backdrops
  content = content.replace(/className="fixed inset-0 z-\[?[0-9]+\]? flex items-center justify-center p-4 bg-black\/[0-9]+ backdrop-blur-sm"/g, 'className="modal-backdrop"');

  // Replace modal containers (typically bg-white dark:bg-gray-800 rounded-2xl shadow-2xl)
  content = content.replace(/className="bg-white dark:bg-gray-[0-9]+ rounded-(xl|2xl) shadow-(xl|2xl) ([^"]*)"/g, (match, border, shadow, extra) => {
     // keep extra classes like width, etc.
     return 'className="glass-modal ' + extra + '"';
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Modified:', file);
    modifiedCount++;
  }
}

console.log('Finished catching modals:', modifiedCount);
