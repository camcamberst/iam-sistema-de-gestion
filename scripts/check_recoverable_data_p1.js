/**
 * 🔍 VERIFICAR DATOS RECUPERABLES P1 ENERO 2026
 * 
 * Verifica si hay algún dato que podamos usar para reconstruir el archivo histórico:
 * 1. Datos en model_values (valores por plataforma)
 * 2. Datos en calculator_totals (totales consolidados)
 * 3. Estructura de calculator_history (para saber cómo insertar)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const PERIOD_DATE = '2026-01-01';

async function check() {
  console.log('🔍 VERIFICANDO DATOS RECUPERABLES P1 ENERO 2026\n');
  console.log('═'.repeat(80));

  // 1. Verificar si hay model_values del P1 que NO se hayan eliminado
  console.log('\n📊 1. BUSCANDO MODEL_VALUES DEL P1...\n');
  
  const { data: modelValues, error: valuesError } = await supabase
    .from('model_values')
    .select(`
      id,
      model_id,
      platform_id,
      value,
      period_date,
      users:model_id (email, name)
    `)
    .gte('period_date', '2026-01-01')
    .lte('period_date', '2026-01-15')
    .order('model_id', { ascending: true });

  if (valuesError) {
    console.error('❌ Error:', valuesError);
  } else {
    console.log(`   Total registros encontrados: ${modelValues?.length || 0}`);
    
    if (modelValues && modelValues.length > 0) {
      const uniqueModels = new Set(modelValues.map(v => v.model_id));
      const uniquePlatforms = new Set(modelValues.map(v => v.platform_id));
      
      console.log(`   ✅ Modelos únicos: ${uniqueModels.size}`);
      console.log(`   ✅ Plataformas únicas: ${uniquePlatforms.size}`);
      console.log(`\n   Muestra de datos (primeros 10):`);
      
      modelValues.slice(0, 10).forEach((v, index) => {
        const email = v.users?.email || 'Desconocido';
        console.log(`   ${index + 1}. ${email.padEnd(30)} | ${v.platform_id.padEnd(20)} | $${v.value} | ${v.period_date}`);
      });
      
      console.log(`\n   🎯 ¡EXCELENTE! HAY DATOS COMPLETOS POR PLATAFORMA`);
      console.log(`   🎯 PODEMOS HACER UNA RECUPERACIÓN COMPLETA`);
    } else {
      console.log(`   ⚠️ No hay datos en model_values`);
      console.log(`   ⚠️ Los datos ya fueron eliminados`);
    }
  }

  // 2. Verificar totals (como respaldo)
  console.log('\n\n📊 2. VERIFICANDO CALCULATOR_TOTALS (RESPALDO)...\n');
  
  const { data: totals, error: totalsError } = await supabase
    .from('calculator_totals')
    .select(`
      model_id,
      total_usd_bruto,
      total_usd_modelo,
      total_cop_modelo,
      users:model_id (email, name)
    `)
    .eq('period_date', PERIOD_DATE);

  if (totalsError) {
    console.error('❌ Error:', totalsError);
  } else {
    const modelsWithData = totals?.filter(t => parseFloat(t.total_usd_bruto || 0) > 0) || [];
    console.log(`   Total modelos con totales: ${totals?.length || 0}`);
    console.log(`   Modelos con totales > 0: ${modelsWithData.length}`);
    
    if (modelsWithData.length > 0) {
      console.log(`\n   Muestra de totales (primeros 5):`);
      modelsWithData.slice(0, 5).forEach((t, index) => {
        const email = t.users?.email || 'Desconocido';
        console.log(`   ${index + 1}. ${email.padEnd(30)} | USD Bruto: $${t.total_usd_bruto} | USD Modelo: $${t.total_usd_modelo}`);
      });
    }
  }

  // 3. Verificar estructura de calculator_history
  console.log('\n\n📊 3. VERIFICANDO ESTRUCTURA DE CALCULATOR_HISTORY...\n');
  
  // Buscar un registro de ejemplo en calculator_history (cualquier período)
  const { data: sampleHistory, error: historyError } = await supabase
    .from('calculator_history')
    .select('*')
    .limit(1)
    .single();

  if (historyError && historyError.code !== 'PGRST116') {
    console.error('❌ Error:', historyError);
  } else if (sampleHistory) {
    console.log('   Campos disponibles en calculator_history:');
    Object.keys(sampleHistory).forEach(key => {
      const value = sampleHistory[key];
      const type = typeof value;
      console.log(`   - ${key.padEnd(25)} (${type})`);
    });
  } else {
    console.log('   ⚠️ No hay registros en calculator_history para usar como muestra');
  }

  // 4. Obtener lista de plataformas válidas
  console.log('\n\n📊 4. OBTENIENDO PLATAFORMAS VÁLIDAS...\n');
  
  const { data: platforms, error: platformsError } = await supabase
    .from('platforms')
    .select('id, name, enabled')
    .eq('enabled', true)
    .order('name', { ascending: true });

  if (platformsError) {
    console.error('❌ Error:', platformsError);
  } else {
    console.log(`   Total plataformas habilitadas: ${platforms?.length || 0}`);
    if (platforms && platforms.length > 0) {
      console.log(`\n   Primeras 10 plataformas:`);
      platforms.slice(0, 10).forEach((p, index) => {
        console.log(`   ${(index + 1).toString().padStart(2)}. ${p.id.padEnd(20)} (${p.name})`);
      });
    }
  }

  // 5. CONCLUSIÓN
  console.log('\n\n═'.repeat(80));
  console.log('\n🔍 CONCLUSIÓN:\n');

  if (modelValues && modelValues.length > 0) {
    console.log('✅ RECUPERACIÓN COMPLETA POSIBLE');
    console.log(`   - Hay ${modelValues.length} registros con valores por plataforma`);
    console.log(`   - Se puede crear un archivo histórico COMPLETO`);
    console.log(`   - Cada modelo tendrá el detalle de todas sus plataformas`);
  } else if (totals && totals.filter(t => parseFloat(t.total_usd_bruto || 0) > 0).length > 0) {
    console.log('⚠️ RECUPERACIÓN PARCIAL POSIBLE');
    console.log(`   - NO hay valores por plataforma`);
    console.log(`   - Solo hay totales consolidados en calculator_totals`);
    console.log(`   - Se podría crear un archivo histórico con totales`);
    console.log(`   - PERO faltaría el detalle por plataforma`);
  } else {
    console.log('❌ NO HAY DATOS RECUPERABLES');
    console.log(`   - No hay valores en model_values`);
    console.log(`   - No hay totales en calculator_totals`);
    console.log(`   - Los datos se perdieron completamente`);
  }

  console.log('\n═'.repeat(80));
  console.log('\n✅ Verificación completada\n');
}

check()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
