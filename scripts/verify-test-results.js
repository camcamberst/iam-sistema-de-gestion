/**
 * Verificar resultados de las pruebas en Supabase
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
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  log('\n🔍 Verificando resultados de pruebas en Supabase...\n', 'cyan');

  // Verificar estados de cierre
  log('📊 Estados de Cierre:', 'cyan');
  const { data: statusData } = await supabase
    .from('calculator_period_closure_status')
    .select('*')
    .eq('period_date', currentDate)
    .order('created_at', { ascending: false });

  if (statusData && statusData.length > 0) {
    log(`   ✅ Encontrados ${statusData.length} registros`, 'green');
    statusData.forEach((s, i) => {
      log(`   ${i + 1}. ${s.status} - ${new Date(s.started_at).toLocaleString('es-ES')}`, 'yellow');
    });
  } else {
    log('   ⚠️ No hay registros de estado', 'yellow');
  }

  // Verificar plataformas congeladas
  log('\n📊 Plataformas Congeladas:', 'cyan');
  const { data: frozenData } = await supabase
    .from('calculator_early_frozen_platforms')
    .select('*')
    .eq('period_date', currentDate)
    .order('frozen_at', { ascending: false });

  if (frozenData && frozenData.length > 0) {
    log(`   ✅ Encontradas ${frozenData.length} plataformas congeladas`, 'green');
    const byPlatform = {};
    frozenData.forEach(f => {
      if (!byPlatform[f.platform_id]) {
        byPlatform[f.platform_id] = [];
      }
      byPlatform[f.platform_id].push(f.model_id);
    });
    Object.entries(byPlatform).forEach(([platform, models]) => {
      log(`   - ${platform.toUpperCase()}: ${models.length} modelos`, 'yellow');
    });
  } else {
    log('   ⚠️ No hay plataformas congeladas registradas', 'yellow');
    log('   (Esto es normal si no hay modelos activos)', 'yellow');
  }

  // Verificar historial
  log('\n📊 Historial Archivado:', 'cyan');
  const { data: historyData } = await supabase
    .from('calculator_history')
    .select('id, period_date, period_type, archived_at')
    .eq('period_date', currentDate)
    .order('archived_at', { ascending: false });

  if (historyData && historyData.length > 0) {
    log(`   ✅ Encontrados ${historyData.length} registros archivados`, 'green');
    const byModel = new Set(historyData.map(h => h.model_id || 'unknown')).size;
    log(`   - Modelos con datos archivados: ${byModel}`, 'yellow');
  } else {
    log('   ⚠️ No hay datos archivados', 'yellow');
    log('   (Esto es normal si no hay modelos activos con valores)', 'yellow');
  }

  log('\n✅ Verificación completada\n', 'green');
}

main().catch(console.error);

