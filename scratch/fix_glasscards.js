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

  // Replace Header Glass Cards
  content = content.replace(/className="relative bg-white\/(80|70) dark:bg-(gray|white)-[0-9]+\/(70|80|\[[0-9.]+\]) backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white\/20 dark:border-(gray|white)-[0-9]+\/(20|\[[0-9.]+\]) shadow-lg[^"]*"/g, 'className="glass-header p-4 sm:p-6 relative"');

  // Replace Content Glass Cards
  content = content.replace(/className="relative bg-white\/(80|70) dark:bg-(gray|white)-[0-9]+\/(70|80|\[[0-9.]+\]) backdrop-blur-sm rounded-xl shadow-md border border-white\/20 dark:border-(gray|white)-[0-9]+\/(20|\[[0-9.]+\]) p-6[^"]*"/g, 'className="glass-card p-6"');

  // Replace Content Glass Cards without relative or other variations
  content = content.replace(/className="bg-white\/(80|70) dark:bg-(gray|white)-[0-9]+\/(70|80|\[[0-9.]+\]) backdrop-blur-sm rounded-xl shadow-md border border-white\/20 dark:border-(gray|white)-[0-9]+\/(20|\[[0-9.]+\]) p-6[^"]*"/g, 'className="glass-card p-6"');

  // Replace Content Glass Cards with dynamic template literals
  content = content.replace(/className={`(mb-[0-9]+ )?relative bg-white\/(80|70) dark:bg-(gray|white)-[0-9]+\/(70|80|\[[0-9.]+\]) backdrop-blur-sm rounded-xl shadow-md border border-white\/20 dark:border-(gray|white)-[0-9]+\/(20|\[[0-9.]+\]) p-6(.*?)`}/g, 'className={`$1glass-card p-6$8`}');

  // Any other variations like the ones in users/page.tsx
  content = content.replace(/className={`(mb-[0-9]+ )?relative bg-white\/(80|70) dark:bg-(gray|white)-[0-9]+\/(70|80|\[[0-9.]+\]) backdrop-blur-sm border border-white\/20 dark:border-(gray|white)-[0-9]+\/(20|\[[0-9.]+\]) rounded-xl shadow-md(.*?)`}/g, 'className={`$1glass-card relative$8`}');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Modified:', file);
    modifiedCount++;
  }
}

console.log(`\nFinished replacing glass cards in ${modifiedCount} files.`);
