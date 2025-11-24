const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllHistory() {
  console.log('🔍 Listando TODOS los periodos en calculator_history...');

  const { data: history, error } = await supabase
    .from('calculator_history')
    .select('period_date, period_type, count(*)')
    // .order('period_date', { ascending: false }); // Group by no soporta order directo a veces en JS client simple
    
  // Hacemos una consulta raw si es posible, o traemos todo y agrupamos en JS (si no son millones)
  const { data: allHistory, error: allError } = await supabase
    .from('calculator_history')
    .select('period_date, period_type');

  if (allError) {
    console.error('❌ Error:', allError);
    return;
  }

  const summary = {};
  allHistory.forEach(r => {
    const key = `${r.period_date} (${r.period_type})`;
    summary[key] = (summary[key] || 0) + 1;
  });

  console.log('📊 Resumen de historial existente:');
  console.table(summary);
  
  // Verificar también model_values
  const { data: allValues, error: valuesError } = await supabase
    .from('model_values')
    .select('period_date');
    
  if (!valuesError) {
      const valuesSummary = {};
      allValues.forEach(r => {
        const key = r.period_date;
        valuesSummary[key] = (valuesSummary[key] || 0) + 1;
      });
      console.log('📊 Resumen de model_values existente:');
      console.table(valuesSummary);
  }
}

checkAllHistory();



