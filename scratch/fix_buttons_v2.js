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

  // Replace primary button classes regardless of the order of text-white
  content = content.replace(/className="([^"]*(?:bg-gradient-to-r from-blue-[0-9]+ to-[a-z]+-[0-9]+|bg-blue-[0-9]+)[^"]*)"/g, (match, classNames) => {
    // Only target if it contains text-white (to avoid badges or labels)
    if (!classNames.includes('text-white')) return match;

    // Optional: we can verify it's a button by regex context, but assuming text-white + bg-blue + padding means it's a button
    // Keep structural classes
    const structClasses = classNames.match(/(w-full|flex-1|mt-[0-9]+|mb-[0-9]+|mx-auto|block|absolute|relative)/g) || [];
    // Keep disabled classes
    const disabledClasses = classNames.match(/(disabled:[a-z0-9:-]+)/g) || [];
    
    return 'className="' + [...structClasses, ...disabledClasses, 'btn-apple-primary'].join(' ') + '"';
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Modified:', file);
    modifiedCount++;
  }
}

console.log('Finished catching buttons v2:', modifiedCount);
