/**
 * 🧪 Script de Testing con Autenticación
 * 
 * Este script prueba el sistema de cierre de períodos usando
 * credenciales de autenticación reales
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch').default || require('node-fetch');

// Configuración
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Credenciales de testing
const SUPER_ADMIN_EMAIL = 'cardozosergio@gmail.com';
const SUPER_ADMIN_PASSWORD = 'CARDOZO@89';

const MODEL_EMAIL = 'angelicawinter@tuemailya.com';
const MODEL_PASSWORD = 'melanie355';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(title, 'cyan');
  log('='.repeat(60), 'cyan');
}

async function authenticateUser(email, password) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      log(`❌ Error autenticando ${email}: ${error.message}`, 'red');
      return { success: false, error };
    }

    log(`✅ Autenticado: ${email}`, 'green');
    return { success: true, session: data.session, user: data.user };
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return { success: false, error };
  }
}

async function testWithAuth(endpoint, method = 'GET', body = null, token) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
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

async function testSupabaseDirect() {
  section('TEST: Verificación Directa en Supabase');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    log('⚠️ Variables de Supabase no configuradas', 'yellow');
    return { success: false };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Verificar tablas
    log('🔍 Verificando tablas...', 'blue');
    
    const { data: statusTable, error: statusError } = await supabase
      .from('calculator_period_closure_status')
      .select('id')
      .limit(1);

    if (statusError) {
      log(`❌ Error accediendo calculator_period_closure_status: ${statusError.message}`, 'red');
      return { success: false, error: statusError };
    }

    log('✅ Tabla calculator_period_closure_status: OK', 'green');

    const { data: frozenTable, error: frozenError } = await supabase
      .from('calculator_early_frozen_platforms')
      .select('id')
      .limit(1);

    if (frozenError) {
      log(`❌ Error accediendo calculator_early_frozen_platforms: ${frozenError.message}`, 'red');
      return { success: false, error: frozenError };
    }

    log('✅ Tabla calculator_early_frozen_platforms: OK', 'green');

    // Obtener modelos para testing
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'modelo')
      .eq('is_active', true)
      .limit(3);

    if (modelsError) {
      log(`❌ Error obteniendo modelos: ${modelsError.message}`, 'red');
    } else {
      log(`✅ Encontrados ${models?.length || 0} modelos:`, 'green');
      models?.forEach((m, i) => {
        log(`   ${i + 1}. ${m.name || m.email} (${m.id.substring(0, 8)}...)`, 'yellow');
      });
    }

    return { success: true, models };
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return { success: false, error };
  }
}

async function testEndpointsPublic() {
  section('TEST: Endpoints Públicos (sin auth)');

  const endpoints = [
    { name: 'Check Status', url: '/api/calculator/period-closure/check-status', method: 'GET' },
    { name: 'Cron Early Freeze', url: '/api/cron/period-closure-early-freeze', method: 'GET' },
    { name: 'Cron Full Close', url: '/api/cron/period-closure-full-close', method: 'GET' }
  ];

  const results = [];

  for (const endpoint of endpoints) {
    log(`\n🧪 Testing: ${endpoint.name}`, 'blue');
    
    try {
      const response = await fetch(`${API_URL}${endpoint.url}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        log(`✅ ${endpoint.name}: OK`, 'green');
        log(`   Respuesta: ${JSON.stringify(data).substring(0, 100)}...`, 'yellow');
        results.push({ name: endpoint.name, success: true, data });
      } else {
        log(`❌ ${endpoint.name}: Error ${response.status}`, 'red');
        results.push({ name: endpoint.name, success: false, status: response.status, data });
      }
    } catch (error) {
      log(`❌ ${endpoint.name}: ${error.message}`, 'red');
      results.push({ name: endpoint.name, success: false, error: error.message });
    }
  }

  return results;
}

async function testEndpointsWithAuth() {
  section('TEST: Endpoints con Autenticación');

  // Autenticar como super admin
  log('\n🔐 Autenticando como super admin...', 'blue');
  const adminAuth = await authenticateUser(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

  if (!adminAuth.success) {
    log('⚠️ No se pudo autenticar, saltando tests con auth', 'yellow');
    return { success: false, skipped: true };
  }

  const token = adminAuth.session.access_token;

  // Test manual close
  log('\n🧪 Testing: Manual Close', 'blue');
  const manualCloseResult = await testWithAuth(
    '/api/calculator/period-closure/manual-close',
    'POST',
    {
      periodDate: new Date().toISOString().split('T')[0],
      targetStatus: 'pending',
      force: true
    },
    token
  );

  if (manualCloseResult.success) {
    log('✅ Manual Close: OK', 'green');
  } else {
    log(`❌ Manual Close: ${manualCloseResult.error || JSON.stringify(manualCloseResult.data)}`, 'red');
  }

  return { success: true, manualClose: manualCloseResult };
}

async function main() {
  log('\n🚀 Iniciando tests completos con autenticación...\n', 'cyan');

  // Test 1: Supabase directo
  const supabaseTest = await testSupabaseDirect();

  // Test 2: Endpoints públicos
  const publicTests = await testEndpointsPublic();

  // Test 3: Endpoints con auth
  const authTests = await testEndpointsWithAuth();

  // Resumen
  section('RESUMEN FINAL');
  
  log('\n📊 Resultados:', 'cyan');
  log(`   ✅ Supabase: ${supabaseTest.success ? 'OK' : 'ERROR'}`, supabaseTest.success ? 'green' : 'red');
  log(`   ✅ Endpoints públicos: ${publicTests.filter(t => t.success).length}/${publicTests.length}`, 'green');
  log(`   ${authTests.skipped ? '⚠️' : '✅'} Endpoints con auth: ${authTests.skipped ? 'SALTADO' : authTests.success ? 'OK' : 'ERROR'}`, authTests.skipped ? 'yellow' : authTests.success ? 'green' : 'red');

  log('\n✨ Tests completados\n', 'cyan');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

