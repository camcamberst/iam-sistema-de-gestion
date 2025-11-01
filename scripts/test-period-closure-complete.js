/**
 * 🧪 Script Completo de Testing: Sistema de Cierre de Períodos
 * 
 * USO:
 * 1. Configurar variables de entorno o editar directamente las constantes
 * 2. node scripts/test-period-closure-complete.js
 * 
 * VARIABLES DE ENTORNO (opcional):
 * - NEXT_PUBLIC_APP_URL: URL de la aplicación (default: http://localhost:3000)
 * - SUPABASE_URL: URL de Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key para consultas directas
 * - TEST_MODEL_ID: ID de modelo para testing
 */

require('dotenv').config({ path: '.env.local' });

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(title, 'cyan');
  log('='.repeat(60), 'cyan');
}

async function makeRequest(url, method = 'GET', body = null, headers = {}) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${url}`, options);
    const data = await response.json();

    return {
      success: response.ok && data.success !== false,
      status: response.status,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Test 1: Verificar estado
async function testCheckStatus() {
  section('TEST 1: Verificar Estado Actual');
  
  const result = await makeRequest('/api/calculator/period-closure/check-status');
  
  if (result.success) {
    log('✅ Endpoint responde correctamente', 'green');
    log(`📅 Período actual: ${result.data.period_date} (${result.data.period_type})`, 'yellow');
    log(`📊 Estado: ${result.data.status || 'Ninguno'}`, 'yellow');
    log(`🔄 Cierre en proceso: ${result.data.is_closing ? 'Sí' : 'No'}`, 'yellow');
  } else {
    log('❌ Error en endpoint', 'red');
    console.log(result);
  }
  
  return result;
}

// Test 2: Verificar tablas en Supabase
async function testSupabaseTables() {
  section('TEST 2: Verificar Tablas en Supabase');
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log('⚠️ Variables de Supabase no configuradas, saltando test', 'yellow');
    return { success: true, skipped: true };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Verificar tabla de estados
    const { data: statusData, error: statusError } = await supabase
      .from('calculator_period_closure_status')
      .select('id')
      .limit(1);

    if (statusError) {
      log('❌ Error accediendo a calculator_period_closure_status', 'red');
      log(`   Error: ${statusError.message}`, 'red');
      return { success: false, error: statusError };
    }

    log('✅ Tabla calculator_period_closure_status accesible', 'green');

    // Verificar tabla de plataformas congeladas
    const { data: frozenData, error: frozenError } = await supabase
      .from('calculator_early_frozen_platforms')
      .select('id')
      .limit(1);

    if (frozenError) {
      log('❌ Error accediendo a calculator_early_frozen_platforms', 'red');
      log(`   Error: ${frozenError.message}`, 'red');
      return { success: false, error: frozenError };
    }

    log('✅ Tabla calculator_early_frozen_platforms accesible', 'green');

    return { success: true };
  } catch (error) {
    log('❌ Error conectando a Supabase', 'red');
    log(`   Error: ${error.message}`, 'red');
    return { success: false, error };
  }
}

// Test 3: Verificar modelos disponibles
async function testGetModels() {
  section('TEST 3: Obtener Modelos para Testing');
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log('⚠️ Variables de Supabase no configuradas, saltando test', 'yellow');
    return { success: true, skipped: true };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: models, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'modelo')
      .eq('is_active', true)
      .limit(5);

    if (error) {
      log('❌ Error obteniendo modelos', 'red');
      return { success: false, error };
    }

    log(`✅ Encontrados ${models?.length || 0} modelos activos:`, 'green');
    models?.forEach((model, idx) => {
      log(`   ${idx + 1}. ${model.name || model.email} (${model.id.substring(0, 8)}...)`, 'yellow');
    });

    return { success: true, models };
  } catch (error) {
    log('❌ Error:', 'red');
    return { success: false, error };
  }
}

// Test 4: Probar estado de plataformas congeladas
async function testPlatformFreezeStatus(modelId) {
  section('TEST 4: Estado de Plataformas Congeladas');
  
  if (!modelId) {
    log('⚠️ No se proporcionó modelId, saltando test', 'yellow');
    return { success: true, skipped: true };
  }

  const result = await makeRequest(
    `/api/calculator/period-closure/platform-freeze-status?modelId=${modelId}`
  );

  if (result.success) {
    log('✅ Endpoint responde correctamente', 'green');
    log(`👤 Modelo: ${result.data.model_id.substring(0, 8)}...`, 'yellow');
    log(`🔒 Plataformas congeladas: ${result.data.frozen_platforms.length}`, 'yellow');
    if (result.data.frozen_platforms.length > 0) {
      log(`   ${result.data.frozen_platforms.join(', ')}`, 'cyan');
    }
  } else {
    log('❌ Error en endpoint', 'red');
    console.log(result);
  }

  return result;
}

// Test 5: Probar cron jobs
async function testCronJobs() {
  section('TEST 5: Verificar Cron Jobs');
  
  // Test Early Freeze Cron
  log('\n🕐 Probando cron de early freeze...', 'blue');
  const earlyFreezeResult = await makeRequest('/api/cron/period-closure-early-freeze');
  
  if (earlyFreezeResult.success) {
    log('✅ Cron early-freeze responde', 'green');
    log(`   Mensaje: ${earlyFreezeResult.data.message}`, 'yellow');
  } else {
    log('❌ Error en cron early-freeze', 'red');
    console.log(earlyFreezeResult);
  }

  // Test Full Close Cron
  log('\n🕐 Probando cron de full close...', 'blue');
  const fullCloseResult = await makeRequest('/api/cron/period-closure-full-close');
  
  if (fullCloseResult.success) {
    log('✅ Cron full-close responde', 'green');
    log(`   Mensaje: ${fullCloseResult.data.message}`, 'yellow');
  } else {
    log('❌ Error en cron full-close', 'red');
    console.log(fullCloseResult);
  }

  return {
    earlyFreeze: earlyFreezeResult,
    fullClose: fullCloseResult
  };
}

// Función principal
async function runAllTests() {
  log('\n🚀 Iniciando tests completos del sistema de cierre de períodos...\n', 'magenta');
  
  const results = {
    checkStatus: null,
    supabaseTables: null,
    models: null,
    platformFreeze: null,
    crons: null
  };

  try {
    // Test 1: Check Status
    results.checkStatus = await testCheckStatus();

    // Test 2: Supabase Tables
    results.supabaseTables = await testSupabaseTables();

    // Test 3: Get Models
    results.models = await testGetModels();
    
    // Test 4: Platform Freeze Status (si hay modelos)
    if (results.models?.models?.length > 0) {
      const testModelId = process.env.TEST_MODEL_ID || results.models.models[0].id;
      results.platformFreeze = await testPlatformFreezeStatus(testModelId);
    }

    // Test 5: Cron Jobs
    results.crons = await testCronJobs();

    // Resumen final
    section('RESUMEN DE TESTS');
    
    const allPassed = Object.values(results).every(r => 
      r === null || r.success || r.skipped
    );

    if (allPassed) {
      log('\n✅ Todos los tests pasaron exitosamente', 'green');
    } else {
      log('\n⚠️ Algunos tests fallaron, revisa los resultados arriba', 'yellow');
    }

    log('\n📋 Resultados detallados:', 'cyan');
    Object.entries(results).forEach(([name, result]) => {
      if (result) {
        const status = result.success || result.skipped ? '✅' : '❌';
        log(`   ${status} ${name}`, result.success || result.skipped ? 'green' : 'red');
      }
    });

  } catch (error) {
    log(`\n❌ Error ejecutando tests: ${error.message}`, 'red');
    console.error(error);
  }

  log('\n✨ Tests completados\n', 'magenta');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };

