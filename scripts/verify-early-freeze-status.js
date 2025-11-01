/**
 * Verificar estado del Early Freeze
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  console.log('\n🔍 Verificando estado del Early Freeze...\n');
  console.log('Fecha Colombia (hoy):', today);

  // Verificar estados de cierre
  const { data: statusData, error: statusError } = await supabase
    .from('calculator_period_closure_status')
    .select('*')
    .eq('period_date', today)
    .order('created_at', { ascending: false })
    .limit(5);

  if (statusError) {
    console.error('❌ Error consultando estados:', statusError);
  } else {
    console.log(`\n📊 Estados de cierre encontrados: ${statusData?.length || 0}`);
    if (statusData && statusData.length > 0) {
      statusData.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.status} - ${new Date(s.created_at).toLocaleString('es-ES')}`);
      });
    } else {
      console.log('   ⚠️ No hay estados de cierre registrados hoy');
    }
  }

  // Verificar plataformas congeladas
  const { data: frozenData, error: frozenError } = await supabase
    .from('calculator_early_frozen_platforms')
    .select('*')
    .eq('period_date', today)
    .order('frozen_at', { ascending: false });

  if (frozenError) {
    console.error('❌ Error consultando plataformas congeladas:', frozenError);
  } else {
    console.log(`\n🔒 Plataformas congeladas encontradas: ${frozenData?.length || 0}`);
    if (frozenData && frozenData.length > 0) {
      // Agrupar por modelo
      const byModel = {};
      frozenData.forEach(f => {
        if (!byModel[f.model_id]) {
          byModel[f.model_id] = [];
        }
        if (!byModel[f.model_id].includes(f.platform_id)) {
          byModel[f.model_id].push(f.platform_id);
        }
      });

      console.log(`   Modelos con plataformas congeladas: ${Object.keys(byModel).length}`);
      Object.entries(byModel).forEach(([modelId, platforms]) => {
        console.log(`   - Modelo ${modelId.substring(0, 8)}...: ${platforms.length} plataformas`);
        platforms.forEach(p => console.log(`     • ${p.toUpperCase()}`));
      });
    } else {
      console.log('   ⚠️ No hay plataformas congeladas registradas hoy');
      console.log('   💡 Esto puede significar que:');
      console.log('      1. El Early Freeze aún no se ejecutó');
      console.log('      2. No hay modelos activos');
      console.log('      3. El cron job no se ejecutó correctamente');
    }
  }

  // Verificar modelos activos
  const { data: models, error: modelsError } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('role', 'modelo')
    .eq('is_active', true)
    .limit(10);

  if (modelsError) {
    console.error('❌ Error consultando modelos:', modelsError);
  } else {
    console.log(`\n👥 Modelos activos: ${models?.length || 0}`);
    if (models && models.length > 0) {
      models.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.name || m.email} (${m.id.substring(0, 8)}...)`);
      });
    }
  }

  console.log('\n✅ Verificación completada\n');
}

main().catch(console.error);

