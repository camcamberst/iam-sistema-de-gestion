/**
 * Script para activar el chatbot ultra-seguro
 * Verifica dependencias y configura el sistema
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 ACTIVANDO CHATBOT ULTRA-SEGURO...\n');

// 1. Verificar archivos necesarios
console.log('📁 Verificando archivos necesarios...');

const requiredFiles = [
  'components/SecurityFilter.ts',
  'components/SecurityConfig.ts',
  'app/api/chat/route.ts',
  'components/ChatWidget.tsx',
  'db/chat_system.sql'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - FALTANTE`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Faltan archivos necesarios. No se puede activar el chatbot.');
  process.exit(1);
}

// 2. Verificar variables de entorno
console.log('\n🔑 Verificando variables de entorno...');

const envFile = '.env.local';
if (!fs.existsSync(envFile)) {
  console.log('⚠️  Archivo .env.local no encontrado');
  console.log('📝 Creando archivo .env.local con configuración básica...');
  
  const envContent = `# Chatbot Ultra-Seguro Configuration
NEXT_PUBLIC_CHAT_SECURITY_LEVEL=ULTRA_SAFE

# Google Gemini API (REQUERIDO)
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Configuration (ya debería existir)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
`;

  fs.writeFileSync(envFile, envContent);
  console.log('✅ Archivo .env.local creado');
} else {
  console.log('✅ Archivo .env.local existe');
}

// 3. Verificar configuración de seguridad
console.log('\n🛡️  Verificando configuración de seguridad...');

try {
  const securityConfig = require('../components/SecurityConfig.ts');
  console.log('✅ SecurityConfig.ts cargado correctamente');
} catch (error) {
  console.log('❌ Error cargando SecurityConfig.ts:', error.message);
}

// 4. Verificar integración en páginas
console.log('\n🔗 Verificando integración en páginas...');

const pagesToCheck = [
  'app/model/calculator/page.tsx',
  'app/admin/model/dashboard/page.tsx'
];

pagesToCheck.forEach(page => {
  if (fs.existsSync(page)) {
    const content = fs.readFileSync(page, 'utf8');
    if (content.includes('ChatWidget')) {
      console.log(`✅ ${page} - ChatWidget integrado`);
    } else {
      console.log(`⚠️  ${page} - ChatWidget NO integrado`);
    }
  } else {
    console.log(`❌ ${page} - Archivo no encontrado`);
  }
});

// 5. Instrucciones finales
console.log('\n🎯 INSTRUCCIONES PARA COMPLETAR LA ACTIVACIÓN:');
console.log('');
console.log('1. 🔑 OBTENER CLAVE DE GOOGLE GEMINI:');
console.log('   - Ve a: https://makersuite.google.com/app/apikey');
console.log('   - Crea una nueva API key');
console.log('   - Copia la clave y pégala en .env.local');
console.log('');
console.log('2. 🗄️  CREAR TABLAS DE BASE DE DATOS:');
console.log('   - Ejecuta: db/chat_system.sql en tu base de datos Supabase');
console.log('   - O usa el panel de Supabase para ejecutar el SQL');
console.log('');
console.log('3. 🚀 REINICIAR LA APLICACIÓN:');
console.log('   - npm run dev (o tu comando de desarrollo)');
console.log('   - El chatbot aparecerá en las páginas integradas');
console.log('');
console.log('4. ✅ VERIFICAR FUNCIONAMIENTO:');
console.log('   - Abre una página con ChatWidget');
console.log('   - Haz clic en el botón de chat');
console.log('   - Envía un mensaje de prueba');
console.log('');

console.log('🛡️  CHATBOT ULTRA-SEGURO LISTO PARA ACTIVAR!');
console.log('   - Filtrado automático de datos sensibles');
console.log('   - Contexto anonimizado');
console.log('   - Respuestas genéricas y seguras');
console.log('   - Sin escalación automática');
console.log('');
