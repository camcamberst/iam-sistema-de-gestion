// 🔍 SCRIPT PARA VERIFICAR CONFIGURACIÓN DEL SISTEMA
// Ejecutar en la consola del navegador

console.log('🔍 [CONFIG] Verificando configuración del sistema...');

// Verificar variables de entorno
function checkEnvironmentVariables() {
  console.log('🔍 [CONFIG] === VARIABLES DE ENTORNO ===');
  
  // Estas no se pueden acceder desde el cliente, pero podemos verificar la configuración
  console.log('🔍 [CONFIG] NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configurada' : '❌ No configurada');
  console.log('🔍 [CONFIG] NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ No configurada');
  
  // Verificar si estamos en el contexto correcto
  console.log('🔍 [CONFIG] URL actual:', window.location.href);
  console.log('🔍 [CONFIG] Es página de admin?', window.location.href.includes('/admin/'));
  console.log('🔍 [CONFIG] Es página de modelo?', window.location.href.includes('/model/'));
}

// Verificar configuración de Supabase
async function checkSupabaseConfig() {
  console.log('🔍 [CONFIG] === CONFIGURACIÓN DE SUPABASE ===');
  
  try {
    // Intentar hacer una consulta simple a Supabase
    const response = await fetch('/api/rates-v2?activeOnly=true');
    const data = await response.json();
    
    console.log('🔍 [CONFIG] Test de API rates:', data.success ? '✅ Funciona' : '❌ Falló');
    console.log('🔍 [CONFIG] Response:', data);
    
  } catch (error) {
    console.error('❌ [CONFIG] Error en test de API:', error);
  }
}

// Verificar configuración de fechas
function checkDateConfiguration() {
  console.log('🔍 [CONFIG] === CONFIGURACIÓN DE FECHAS ===');
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const berlinTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Berlin"}));
  const berlinDate = berlinTime.toISOString().split('T')[0];
  
  console.log('🔍 [CONFIG] Fecha local:', today);
  console.log('🔍 [CONFIG] Fecha Berlin:', berlinDate);
  console.log('🔍 [CONFIG] Diferencia:', today !== berlinDate ? '⚠️ Diferente' : '✅ Igual');
  
  // Verificar si getCalculatorDate está funcionando
  fetch('/api/calculator/config-v2?modelId=test')
    .then(response => response.json())
    .then(data => {
      console.log('🔍 [CONFIG] Test de config API:', data.success ? '✅ Funciona' : '❌ Falló');
    })
    .catch(error => {
      console.error('❌ [CONFIG] Error en test de config:', error);
    });
}

// Verificar permisos y autenticación
async function checkAuthentication() {
  console.log('🔍 [CONFIG] === AUTENTICACIÓN ===');
  
  try {
    // Verificar si hay usuario autenticado
    const response = await fetch('/api/auth/session');
    const data = await response.json();
    
    console.log('🔍 [CONFIG] Usuario autenticado:', data.user ? '✅ Sí' : '❌ No');
    if (data.user) {
      console.log('🔍 [CONFIG] Usuario:', data.user.email);
      console.log('🔍 [CONFIG] Rol:', data.user.role);
    }
    
  } catch (error) {
    console.error('❌ [CONFIG] Error en verificación de auth:', error);
  }
}

// Verificar estructura de la base de datos
async function checkDatabaseStructure() {
  console.log('🔍 [CONFIG] === ESTRUCTURA DE BASE DE DATOS ===');
  
  try {
    // Intentar hacer una consulta que nos dé información sobre la estructura
    const response = await fetch('/api/calculator/model-values-v2?modelId=test&periodDate=2025-01-20');
    const data = await response.json();
    
    console.log('🔍 [CONFIG] Test de model-values API:', data.success ? '✅ Funciona' : '❌ Falló');
    console.log('🔍 [CONFIG] Response:', data);
    
    if (!data.success) {
      console.log('🔍 [CONFIG] Error details:', data.error);
    }
    
  } catch (error) {
    console.error('❌ [CONFIG] Error en test de DB:', error);
  }
}

// Ejecutar todas las verificaciones
async function runConfigurationCheck() {
  console.log('🔍 [CONFIG] === INICIANDO VERIFICACIÓN DE CONFIGURACIÓN ===');
  
  checkEnvironmentVariables();
  await checkSupabaseConfig();
  checkDateConfiguration();
  await checkAuthentication();
  await checkDatabaseStructure();
  
  console.log('🔍 [CONFIG] === FIN DE VERIFICACIÓN ===');
}

// Ejecutar automáticamente
runConfigurationCheck();

console.log('🔍 [CONFIG] Script de verificación cargado. Usa runConfigurationCheck() para ejecutar nuevamente.');
