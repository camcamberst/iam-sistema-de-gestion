const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  'https://mhernfrkvwigxdubiozm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c'
);

async function debugHistoryValues() {
  try {
    console.log('🔍 [DEBUG] Verificando valores en calculator_history...');
    
    // 1. Todos los registros
    const { data: allRecords, error: allError } = await supabase
      .from('calculator_history')
      .select('*');
    
    if (allError) {
      console.error('❌ Error:', allError);
      return;
    }
    
    console.log('📊 [DEBUG] Todos los registros en calculator_history:');
    console.log('  - Total registros:', allRecords?.length || 0);
    console.log('  - Modelos únicos:', new Set(allRecords?.map(r => r.model_id) || []).size);
    console.log('  - Tipos de período:', new Set(allRecords?.map(r => r.period_type) || []));
    console.log('  - Suma total valores:', allRecords?.reduce((sum, r) => sum + (r.value || 0), 0) || 0);
    
    // 2. Por período
    const periods = {};
    allRecords?.forEach(record => {
      if (!periods[record.period_type]) {
        periods[record.period_type] = {
          count: 0,
          models: new Set(),
          sum: 0
        };
      }
      periods[record.period_type].count++;
      periods[record.period_type].models.add(record.model_id);
      periods[record.period_type].sum += record.value || 0;
    });
    
    console.log('📊 [DEBUG] Por período:');
    Object.entries(periods).forEach(([period, data]) => {
      console.log(`  - ${period}: ${data.count} registros, ${data.models.size} modelos, suma: ${data.sum}`);
    });
    
    // 3. Valores individuales del período 1-15
    const period1Records = allRecords?.filter(r => r.period_type === '1-15') || [];
    console.log('📊 [DEBUG] Valores individuales período 1-15:');
    period1Records.forEach(record => {
      console.log(`  - Modelo: ${record.model_id}, Plataforma: ${record.platform_id}, Valor: ${record.value}`);
    });
    
    // 4. Verificar si hay valores en model_values para comparar
    const { data: modelValues, error: modelValuesError } = await supabase
      .from('model_values')
      .select('*')
      .gte('period_date', '2025-10-01')
      .lte('period_date', '2025-10-31');
    
    if (!modelValuesError) {
      console.log('📊 [DEBUG] Valores actuales en model_values (octubre):');
      console.log('  - Total registros:', modelValues?.length || 0);
      console.log('  - Modelos únicos:', new Set(modelValues?.map(r => r.model_id) || []).size);
      console.log('  - Suma total valores:', modelValues?.reduce((sum, r) => sum + (r.value || 0), 0) || 0);
    }
    
    // 5. Verificar valores en calculator_totals
    const { data: calculatorTotals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .gte('period_date', '2025-10-01')
      .lte('period_date', '2025-10-31');
    
    if (!totalsError) {
      console.log('📊 [DEBUG] Valores en calculator_totals (octubre):');
      console.log('  - Total registros:', calculatorTotals?.length || 0);
      console.log('  - Modelos únicos:', new Set(calculatorTotals?.map(r => r.model_id) || []).size);
      console.log('  - Suma USD Modelo:', calculatorTotals?.reduce((sum, r) => sum + (r.total_usd_modelo || 0), 0) || 0);
      console.log('  - Suma COP Modelo:', calculatorTotals?.reduce((sum, r) => sum + (r.total_cop_modelo || 0), 0) || 0);
    }
    
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
  }
}

debugHistoryValues();
