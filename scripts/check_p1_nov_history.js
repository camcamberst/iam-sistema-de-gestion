const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Falta configuración de Supabase en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHistory() {
  console.log('🔍 Verificando historial para el periodo P1 de Noviembre (2024-11-01)...');

  // 1. Buscar registros en calculator_history para period_date '2024-11-01'
  const { data: historyP1, error: errorP1 } = await supabase
    .from('calculator_history')
    .select('*')
    .eq('period_date', '2024-11-01');

  if (errorP1) {
    console.error('❌ Error consultando calculator_history:', errorP1);
  } else {
    console.log(`📊 Registros encontrados en calculator_history para 2024-11-01: ${historyP1.length}`);
    if (historyP1.length > 0) {
      console.log('   Ejemplo:', historyP1[0]);
      // Agrupar por modelo para ver cuántos modelos tienen datos
      const models = new Set(historyP1.map(r => r.model_id));
      console.log(`   Modelos con datos: ${models.size}`);
    }
  }

  // 2. Buscar registros cercanos por si la fecha es diferente (ej: 2024-11-16 cerrando el periodo anterior)
  // A veces el periodo se guarda con la fecha de cierre en lugar de la de inicio, o viceversa.
  const { data: historyNearby, error: errorNearby } = await supabase
    .from('calculator_history')
    .select('*')
    .gte('period_date', '2024-10-25')
    .lte('period_date', '2024-11-20')
    .order('period_date', { ascending: false });

  if (errorNearby) {
    console.error('❌ Error consultando registros cercanos:', errorNearby);
  } else {
    console.log(`📊 Registros cercanos encontrados (25 Oct - 20 Nov): ${historyNearby.length}`);
    const dates = {};
    historyNearby.forEach(r => {
      dates[r.period_date] = (dates[r.period_date] || 0) + 1;
    });
    console.log('   Distribución por fecha:', dates);
  }

  // 3. Verificar model_values para ver si hay datos "crudos" de ese periodo
  const { data: valuesP1, error: errorValues } = await supabase
    .from('model_values')
    .select('*')
    .eq('period_date', '2024-11-01');
    
   if (errorValues) {
    console.error('❌ Error consultando model_values:', errorValues);
  } else {
    console.log(`📊 Registros encontrados en model_values para 2024-11-01: ${valuesP1.length}`);
  }
}

checkHistory();



