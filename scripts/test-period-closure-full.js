/**
 * 🧪 Pruebas Completas del Sistema de Cierre de Períodos
 * 
 * Este script ejecuta pruebas completas incluyendo early-freeze y close-period
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch').default || require('node-fetch');

// Activar modo testing
process.env.TESTING_MODE = 'true';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(title, 'cyan');
  log('='.repeat(70), 'cyan');
}

async function makeRequest(url, method = 'GET', body = null, testingMode = true) {
  try {
    const options = {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'x-testing-mode': testingMode ? 'true' : 'false'
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

async function verifySupabase() {
  section('VERIFICACIÓN INICIAL: SUPABASE');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  // Verificar modelos activos
  const { data: models } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('role', 'modelo')
    .eq('is_active', true)
    .limit(5);

  if (!models || models.length === 0) {
    log('⚠️ No hay modelos activos - algunos tests pueden fallar', 'yellow');
    return null;
  }

  log(`✅ Encontrados ${models.length} modelos activos`, 'green');
  models.forEach((m, i) => {
    log(`   ${i + 1}. ${m.name || m.email} (${m.id.substring(0, 8)}...)`, 'yellow');
  });

  return models;
}

async function testCheckStatus() {
  section('TEST 1: CHECK STATUS');
  
  const result = await makeRequest('/api/calculator/period-closure/check-status');
  
  if (result.success) {
    log('✅ Endpoint funciona correctamente', 'green');
    log(`   Período: ${result.data.period_date} (${result.data.period_type})`, 'yellow');
    log(`   Estado: ${result.data.status || 'Ninguno'}`, 'yellow');
  } else {
    log('❌ Error en endpoint', 'red');
    console.log(result);
  }

  return result;
}

async function testEarlyFreeze() {
  section('TEST 2: EARLY FREEZE (Congelación Anticipada)');
  
  log('🔄 Ejecutando congelación anticipada de 10 plataformas especiales...', 'blue');
  
  const result = await makeRequest(
    '/api/calculator/period-closure/early-freeze',
    'POST'
  );

  if (result.success) {
    log('✅ Early Freeze ejecutado exitosamente', 'green');
    log(`   Modelos procesados: ${result.data.results?.total_models || 0}`, 'yellow');
    log(`   Exitosos: ${result.data.results?.successful || 0}`, 'green');
    log(`   Fallidos: ${result.data.results?.failed || 0}`, result.data.results?.failed > 0 ? 'red' : 'green');
    
    if (result.data.frozen_platforms) {
      log(`   Plataformas congeladas: ${result.data.frozen_platforms.length}`, 'cyan');
      result.data.frozen_platforms.forEach((p, i) => {
        log(`      ${i + 1}. ${p.toUpperCase()}`, 'cyan');
      });
    }

    // Verificar en Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: frozen } = await supabase
      .from('calculator_early_frozen_platforms')
      .select('*')
      .limit(10);

    log(`\n   📊 Verificación BD: ${frozen?.length || 0} plataformas congeladas registradas`, 'yellow');
  } else {
    log('❌ Error en Early Freeze', 'red');
    console.log(result);
  }

  return result;
}

async function testClosePeriod() {
  section('TEST 3: CLOSE PERIOD (Cierre Completo)');
  
  log('🔄 Ejecutando cierre completo de período...', 'blue');
  log('   ⏳ Esto tomará aproximadamente 5 segundos (modo testing)...', 'yellow');
  
  const startTime = Date.now();
  const result = await makeRequest(
    '/api/calculator/period-closure/close-period',
    'POST'
  );
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  if (result.success) {
    log(`✅ Close Period ejecutado exitosamente (${duration}s)`, 'green');
    log(`   Archivo: ${result.data.archive_summary?.successful || 0} modelos archivados`, 'yellow');
    log(`   Reset: ${result.data.reset_summary?.successful || 0} modelos reseteados`, 'yellow');

    // Verificar en Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    // Verificar historial
    const { data: history } = await supabase
      .from('calculator_history')
      .select('id, model_id, period_date')
      .eq('period_date', currentDate)
      .limit(10);

    log(`\n   📊 Verificación BD:`, 'yellow');
    log(`      - Valores archivados: ${history?.length || 0}`, history && history.length > 0 ? 'green' : 'yellow');
    
    // Verificar estado
    const { data: status } = await supabase
      .from('calculator_period_closure_status')
      .select('status')
      .eq('period_date', currentDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    log(`      - Estado final: ${status?.status || 'N/A'}`, status?.status === 'completed' ? 'green' : 'yellow');
  } else {
    log('❌ Error en Close Period', 'red');
    console.log(result);
  }

  return result;
}

async function testPlatformFreezeStatus(models) {
  section('TEST 4: PLATFORM FREEZE STATUS');
  
  if (!models || models.length === 0) {
    log('⚠️ No hay modelos para probar', 'yellow');
    return null;
  }

  const testModel = models[0];
  log(`🧪 Probando con modelo: ${testModel.name || testModel.email}`, 'blue');

  const result = await makeRequest(
    `/api/calculator/period-closure/platform-freeze-status?modelId=${testModel.id}`
  );

  if (result.success) {
    log('✅ Endpoint funciona correctamente', 'green');
    log(`   Plataformas congeladas: ${result.data.frozen_platforms?.length || 0}`, 'yellow');
    if (result.data.frozen_platforms && result.data.frozen_platforms.length > 0) {
      result.data.frozen_platforms.forEach((p, i) => {
        log(`      ${i + 1}. ${p.toUpperCase()}`, 'cyan');
      });
    }
  } else {
    log('❌ Error en endpoint', 'red');
    console.log(result);
  }

  return result;
}

async function main() {
  log('\n🚀 INICIANDO PRUEBAS COMPLETAS DEL SISTEMA DE CIERRE\n', 'magenta');
  log('⚠️  MODO TESTING ACTIVADO - Validaciones temporales desactivadas\n', 'yellow');

  const results = {
    checkStatus: null,
    earlyFreeze: null,
    closePeriod: null,
    platformFreeze: null
  };

  try {
    // Verificar modelos
    const models = await verifySupabase();

    // Test 1: Check Status
    results.checkStatus = await testCheckStatus();

    // Test 2: Early Freeze
    results.earlyFreeze = await testEarlyFreeze();

    // Esperar un momento entre pruebas
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Close Period
    results.closePeriod = await testClosePeriod();

    // Test 4: Platform Freeze Status
    results.platformFreeze = await testPlatformFreezeStatus(models);

    // RESUMEN FINAL
    section('RESUMEN FINAL DE PRUEBAS');

    const allPassed = Object.values(results).every(r => 
      r === null || r.success
    );

    log('\n📊 Resultados:', 'cyan');
    Object.entries(results).forEach(([name, result]) => {
      if (result) {
        const status = result.success ? '✅' : '❌';
        const color = result.success ? 'green' : 'red';
        log(`   ${status} ${name}`, color);
      } else {
        log(`   ⚠️  ${name} (saltado)`, 'yellow');
      }
    });

    if (allPassed) {
      log('\n✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE', 'green');
      log('   El sistema de cierre de períodos está completamente funcional', 'green');
    } else {
      log('\n⚠️ ALGUNAS PRUEBAS FALLARON', 'yellow');
      log('   Revisa los detalles arriba para más información', 'yellow');
    }

    log('\n⚠️  IMPORTANTE: Revierte los cambios temporales en utils/period-closure-dates.ts', 'yellow');
    log('   Elimina las líneas que verifican TESTING_MODE', 'yellow');

  } catch (error) {
    log(`\n❌ Error ejecutando tests: ${error.message}`, 'red');
    console.error(error);
  }

  log('\n✨ Pruebas completadas\n', 'magenta');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

