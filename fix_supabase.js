const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetDir = path.join(__dirname, 'app/admin/model');
walkDir(targetDir, function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Si importa createClient y crea supabase
    if (content.includes('createClient(')) {
      content = content.replace(/import\s*\{\s*createClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"];?/g, "import { supabase } from '@/lib/supabase';");
      content = content.replace(/const\s+supabase\s*=\s*createClient\([^)]*\);?/g, "");
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed:', filePath);
    }
  }
});
