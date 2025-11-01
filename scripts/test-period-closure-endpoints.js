/**
 * 🧪 Script de Testing: Endpoints de Cierre de Períodos
 * 
 * Ejecutar con: node scripts/test-period-closure-endpoints.js
 */

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, url, method = 'GET', body = null) {
  try {
    log(`\n🧪 Testing: ${name}`, 'blue');
    log(`📍 ${method} ${url}`, 'yellow');

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${url}`, options);
    const data = await response.json();

    if (response.ok && data.success !== false) {
      log(`✅ Success`, 'green');
      console.log(JSON.stringify(data, null, 2));
      return { success: true, data };
    } else {
      log(`❌ Failed`, 'red');
      console.log(JSON.stringify(data, null, 2));
      return { success: false, data };
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function main() {
  log('\n🚀 Iniciando tests de endpoints de cierre de períodos...\n', 'blue');

  // Test 1: Check Status
  await testEndpoint(
    'Check Status',
    '/api/calculator/period-closure/check-status'
  );

  // Test 2: Platform Freeze Status (necesita modelId real)
  // Descomentar y agregar un modelId real
  // await testEndpoint(
  //   'Platform Freeze Status',
  //   '/api/calculator/period-closure/platform-freeze-status?modelId=TU_MODEL_ID'
  // );

  // Test 3: Early Freeze (solo si es medianoche Europa Central)
  // Para forzar, descomentar temporalmente
  // await testEndpoint(
  //   'Early Freeze',
  //   '/api/calculator/period-closure/early-freeze',
  //   'POST'
  // );

  // Test 4: Close Period (solo si es día 1/16 y 00:00 Colombia)
  // Para forzar, descomentar temporalmente
  // await testEndpoint(
  //   'Close Period',
  //   '/api/calculator/period-closure/close-period',
  //   'POST'
  // );

  // Test 5: Cron Early Freeze
  await testEndpoint(
    'Cron Early Freeze',
    '/api/cron/period-closure-early-freeze'
  );

  // Test 6: Cron Full Close
  await testEndpoint(
    'Cron Full Close',
    '/api/cron/period-closure-full-close'
  );

  log('\n✅ Tests completados\n', 'green');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEndpoint };

