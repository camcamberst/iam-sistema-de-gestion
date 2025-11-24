const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepDiagnose() {
  console.log('🕵️‍♂️ Diagnóstico profundo...');

  // 1. Ver qué hay ULTIMO en calculator_history
  const { data: lastHistory, error: historyError } = await supabase
    .from('calculator_history')
    .select('*')
    .order('id', { ascending: false })
    .limit(5);

  console.log('\n📊 Últimos 5 registros en calculator_history:');
  if (lastHistory) {
    lastHistory.forEach(h => {
        console.log(`   ID: ${h.id}, Fecha: ${h.period_date}, Plat: ${h.platform_id}, Val: ${h.value}`);
    });
  } else {
      console.log('   (Ninguno o error)');
  }

  // 2. Ver qué hay en calculator_totals cerca de Noviembre
  const { data: totals, error: totalsError } = await supabase
    .from('calculator_totals')
    .select('*')
    .gte('period_date', '2025-11-01')
    .order('period_date', { ascending: false });

  console.log('\n📊 Registros en calculator_totals (Nov 2025):');
  if (totals) {
      console.log(`   Total encontrados: ${totals.length}`);
      // Agrupar por fecha para ver disponibilidad
      const dateCounts = {};
      totals.forEach(t => {
          dateCounts[t.period_date] = (dateCounts[t.period_date] || 0) + 1;
      });
      console.table(dateCounts);
  }

  // 3. Intentar una inserción de prueba y ver el error explícito
  console.log('\n🧪 Intentando inserción de prueba...');
  const testInsert = {
    model_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
    platform_id: 'TEST_DEBUG',
    value: 123.45,
    period_date: '2025-11-01',
    period_type: '1-15',
    archived_at: new Date().toISOString()
  };

  const { data: inserted, error: insertError } = await supabase
    .from('calculator_history')
    .insert([testInsert])
    .select();

  if (insertError) {
      console.error('❌ Error de inserción de prueba:', insertError);
  } else {
      console.log('✅ Inserción de prueba exitosa:', inserted);
      // Borrar la prueba
      await supabase.from('calculator_history').delete().eq('platform_id', 'TEST_DEBUG');
  }
}

deepDiagnose();



