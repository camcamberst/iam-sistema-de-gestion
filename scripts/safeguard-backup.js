const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const BACKUP_ROOT = path.join(ROOT_DIR, '..', 'iam-gestion_backups');

// Carpetas o archivos a resguardar para poder restaurar un estado front-end completo
const TARGETS = [
  'app',
  'components',
  'lib',
  'utils',
  'types',
  'public',
  'scripts',
  '_docs',
  'package.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'tsconfig.json',
  'globals.css' // Si está en la raíz
];

function getTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}_${d.getHours().toString().padStart(2, '0')}${d.getMinutes().toString().padStart(2, '0')}${d.getSeconds().toString().padStart(2, '0')}`;
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((child) => {
      // Omitir node_modules o .git si alguien por accidente los pone ahí
      if (child === 'node_modules' || child === '.git') return;
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

async function runBackup() {
  console.log(`[SafeGuard] Iniciando backup...`);
  
  if (!fs.existsSync(BACKUP_ROOT)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  }

  const timestamp = getTimestamp();
  const backupFolder = path.join(BACKUP_ROOT, `backup_src_${timestamp}`);
  fs.mkdirSync(backupFolder, { recursive: true });

  let itemsCopied = 0;

  for (const item of TARGETS) {
    const srcPath = path.join(ROOT_DIR, item);
    const destPath = path.join(backupFolder, item);
    
    if (fs.existsSync(srcPath)) {
      copyRecursiveSync(srcPath, destPath);
      itemsCopied++;
      console.log(` ✅ Copiado: ${item}`);
    } else {
       // Buscar globals.css dentro de app o en directorio base por seguridad si se listó genérico
      if(item === 'globals.css') continue;
      console.log(` ⚠️ Saltando (no encontrado): ${item}`);
    }
  }

  console.log(`\n[SafeGuard] Backup exitoso completado en: \n -> ${backupFolder}\n${itemsCopied} bloques resguardados con éxito.`);
}

runBackup();
