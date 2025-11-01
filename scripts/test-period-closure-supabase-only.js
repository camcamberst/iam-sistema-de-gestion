/**
 * 🧪 Test Solo Supabase: Verificar tablas y datos
 * 
 * Este script verifica directamente en Supabase sin necesidad
 * de que el servidor Next.js esté corriendo
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function main() {
  log('\n🚀 Verificando sistema de cierre en Supabase...\n', 'magenta');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log('❌ Variables de Supabase no configuradas', 'red');
    log('   Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local', 'yellow');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // TEST 1: Verificar tablas
  section('TEST 1: Verificar Tablas');
  
  try {
    // Tabla calculator_period_closure_status
    const { data: statusData, error: statusError } = await supabase
      .from('calculator_period_closure_status')
      .select('id, period_date, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (statusError) {
      log(`❌ Error accediendo calculator_period_closure_status`, 'red');
      log(`   ${statusError.message}`, 'red');
    } else {
      log(`✅ Tabla calculator_period_closure_status: OK`, 'green');
      log(`   Registros encontrados: ${statusData?.length || 0}`, 'yellow');
      if (statusData && statusData.length > 0) {
        log(`   Últimos registros:`, 'yellow');
        statusData.forEach((r, i) => {
          log(`   ${i + 1}. ${r.period_date} - ${r.status} (${new Date(r.created_at).toLocaleString('es-ES')})`, 'cyan');
        });
      }
    }

    // Tabla calculator_early_frozen_platforms
    const { data: frozenData, error: frozenError } = await supabase
      .from('calculator_early_frozen_platforms')
      .select('id, period_date, model_id, platform_id, frozen_at')
      .order('frozen_at', { ascending: false })
      .limit(10);

    if (frozenError) {
      log(`❌ Error accediendo calculator_early_frozen_platforms`, 'red');
      log(`   ${frozenError.message}`, 'red');
    } else {
      log(`✅ Tabla calculator_early_frozen_platforms: OK`, 'green');
      log(`   Registros encontrados: ${frozenData?.length || 0}`, 'yellow');
      if (frozenData && frozenData.length > 0) {
        log(`   Últimos registros:`, 'yellow');
        frozenData.forEach((r, i) => {
          log(`   ${i + 1}. ${r.period_date} - ${r.platform_id} (${new Date(r.frozen_at).toLocaleString('es-ES')})`, 'cyan');
        });
      }
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  }

  // TEST 2: Verificar modelos
  section('TEST 2: Verificar Modelos Activos');
  
  try {
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name, role, is_active')
      .eq('role', 'modelo')
      .eq('is_active', true)
      .limit(10);

    if (modelsError) {
      log(`❌ Error obteniendo modelos: ${modelsError.message}`, 'red');
    } else {
      log(`✅ Modelos encontrados: ${models?.length || 0}`, 'green');
      if (models && models.length > 0) {
        models.forEach((m, i) => {
          log(`   ${i + 1}. ${m.name || m.email} (${m.id.substring(0, 8)}...)`, 'yellow');
        });
      } else {
        log(`   ⚠️ No hay modelos activos para testing`, 'yellow');
      }
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  }

  // TEST 3: Verificar plataformas
  section('TEST 3: Verificar Plataformas Especiales');
  
  const EARLY_FREEZE_PLATFORMS = [
    'superfoon',
    'livecreator',
    'mdh',
    '777',
    'xmodels',
    'big7',
    'mondo',
    'vx',
    'babestation',
    'dirtyfans'
  ];

  try {
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, name, active')
      .in('id', EARLY_FREEZE_PLATFORMS);

    if (platformsError) {
      log(`❌ Error obteniendo plataformas: ${platformsError.message}`, 'red');
    } else {
      log(`✅ Plataformas especiales encontradas: ${platforms?.length || 0}`, 'green');
      const found = platforms?.map(p => p.id) || [];
      const missing = EARLY_FREEZE_PLATFORMS.filter(p => !found.includes(p));
      
      if (missing.length > 0) {
        log(`   ⚠️ Plataformas faltantes: ${missing.join(', ')}`, 'yellow');
      }
      
      platforms?.forEach((p, i) => {
        const status = p.active ? '✅' : '❌';
        log(`   ${status} ${i + 1}. ${p.name || p.id} (${p.id})`, p.active ? 'green' : 'red');
      });
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  }

  // TEST 4: Verificar datos de calculadora
  section('TEST 4: Verificar Datos de Calculadora');
  
  try {
    // Verificar model_values actuales
    const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    
    const { data: currentValues, error: valuesError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, period_date')
      .eq('period_date', currentDate)
      .limit(10);

    if (valuesError) {
      log(`❌ Error obteniendo valores: ${valuesError.message}`, 'red');
    } else {
      log(`✅ Valores actuales encontrados: ${currentValues?.length || 0}`, 'green');
      log(`   Período actual: ${currentDate}`, 'yellow');
      if (currentValues && currentValues.length > 0) {
        const uniqueModels = new Set(currentValues.map(v => v.model_id));
        log(`   Modelos con valores: ${uniqueModels.size}`, 'yellow');
      }
    }

    // Verificar calculator_history
    const { data: historyData, error: historyError } = await supabase
      .from('calculator_history')
      .select('id, period_date, period_type, archived_at')
      .order('archived_at', { ascending: false })
      .limit(5);

    if (historyError) {
      log(`❌ Error obteniendo historial: ${historyError.message}`, 'red');
    } else {
      log(`✅ Registros históricos encontrados: ${historyData?.length || 0}`, 'green');
      if (historyData && historyData.length > 0) {
        log(`   Últimos períodos archivados:`, 'yellow');
        historyData.forEach((h, i) => {
          log(`   ${i + 1}. ${h.period_date} (${h.period_type}) - ${new Date(h.archived_at).toLocaleString('es-ES')}`, 'cyan');
        });
      }
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  }

  // RESUMEN
  section('RESUMEN');
  log('\n✅ Verificación de Supabase completada', 'green');
  log('   Si todas las tablas están OK, el sistema está listo', 'yellow');
  log('   Para probar endpoints, asegúrate de que el servidor Next.js esté corriendo', 'yellow');
  log('\n✨ Tests completados\n', 'magenta');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

