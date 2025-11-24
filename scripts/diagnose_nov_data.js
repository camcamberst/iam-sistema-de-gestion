const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseNovData() {
  console.log('🔍 [DIAGNOSTICO] Analizando model_values para Noviembre 1-15...');

  // Consultar distribución de fechas en model_values
  const { data: values, error } = await supabase
    .from('model_values')
    .select('period_date, value, model_id')
    .gte('period_date', '2024-11-01')
    .lte('period_date', '2024-11-16'); // Incluir hasta el 16 por si acaso

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Total registros encontrados: ${values.length}`);

  // Agrupar por fecha
  const byDate = {};
  values.forEach(v => {
    if (!byDate[v.period_date]) byDate[v.period_date] = { count: 0, sumValue: 0, models: new Set() };
    byDate[v.period_date].count++;
    byDate[v.period_date].sumValue += v.value;
    byDate[v.period_date].models.add(v.model_id);
  });

  console.log('\n📅 Distribución por Fecha (model_values):');
  console.table(
    Object.keys(byDate).sort().map(date => ({
      date,
      count: byDate[date].count,
      totalValue: Math.round(byDate[date].sumValue),
      uniqueModels: byDate[date].models.size
    }))
  );

  // Verificar calculator_totals también (respaldos diarios)
  const { data: totals, error: totalsError } = await supabase
    .from('calculator_totals')
    .select('period_date, total_usd_modelo, model_id')
    .gte('period_date', '2024-11-01')
    .lte('period_date', '2024-11-16');

  if (!totalsError) {
    const totalsByDate = {};
    totals.forEach(t => {
        if (!totalsByDate[t.period_date]) totalsByDate[t.period_date] = { count: 0, sumUsd: 0, models: new Set() };
        totalsByDate[t.period_date].count++;
        totalsByDate[t.period_date].sumUsd += t.total_usd_modelo;
        totalsByDate[t.period_date].models.add(t.model_id);
    });
    
    console.log('\n📅 Distribución por Fecha (calculator_totals):');
    console.table(
        Object.keys(totalsByDate).sort().map(date => ({
        date,
        count: totalsByDate[date].count,
        totalUsd: Math.round(totalsByDate[date].sumUsd),
        uniqueModels: totalsByDate[date].models.size
        }))
    );
  }
}

diagnoseNovData();



