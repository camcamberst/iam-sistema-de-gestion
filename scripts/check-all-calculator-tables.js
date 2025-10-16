const { createClient } = require('@supabase/supabase-js');

// Variables de entorno directas
const supabase = createClient(
  'https://mhernfrkvwigxdubiozm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c'
);

async function checkAllTables() {
  try {
    console.log('🔍 [VERIFICACIÓN] Verificando todas las tablas relacionadas con calculadora...');
    
    // 1. Verificar calculator_history
    console.log('\n📊 [VERIFICACIÓN] 1. calculator_history:');
    const { data: historyData, error: historyError } = await supabase
      .from('calculator_history')
      .select('*')
      .limit(5);
    
    if (historyError) {
      console.error('❌ Error en calculator_history:', historyError);
    } else {
      console.log(`✅ Registros en calculator_history: ${historyData?.length || 0}`);
      if (historyData && historyData.length > 0) {
        historyData.forEach((record, index) => {
          console.log(`  ${index + 1}. Model: ${record.model_id}, Platform: ${record.platform_id}, Value: ${record.value}, Period: ${record.period_type}, Date: ${record.period_date}`);
        });
      }
    }
    
    // 2. Verificar model_values
    console.log('\n📊 [VERIFICACIÓN] 2. model_values:');
    const { data: modelValuesData, error: modelValuesError } = await supabase
      .from('model_values')
      .select('*')
      .limit(5);
    
    if (modelValuesError) {
      console.error('❌ Error en model_values:', modelValuesError);
    } else {
      console.log(`✅ Registros en model_values: ${modelValuesData?.length || 0}`);
      if (modelValuesData && modelValuesData.length > 0) {
        modelValuesData.forEach((record, index) => {
          console.log(`  ${index + 1}. Model: ${record.model_id}, Platform: ${record.platform_id}, Value: ${record.value}, Date: ${record.period_date}`);
        });
      }
    }
    
    // 3. Verificar calculator_totals
    console.log('\n📊 [VERIFICACIÓN] 3. calculator_totals:');
    const { data: totalsData, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .limit(5);
    
    if (totalsError) {
      console.error('❌ Error en calculator_totals:', totalsError);
    } else {
      console.log(`✅ Registros en calculator_totals: ${totalsData?.length || 0}`);
      if (totalsData && totalsData.length > 0) {
        totalsData.forEach((record, index) => {
          console.log(`  ${index + 1}. Model: ${record.model_id}, USD Bruto: ${record.total_usd_bruto}, USD Modelo: ${record.total_usd_modelo}, Date: ${record.period_date}`);
        });
      }
    }
    
    // 4. Verificar daily_earnings_history
    console.log('\n📊 [VERIFICACIÓN] 4. daily_earnings_history:');
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_earnings_history')
      .select('*')
      .limit(5);
    
    if (dailyError) {
      console.error('❌ Error en daily_earnings_history:', dailyError);
    } else {
      console.log(`✅ Registros en daily_earnings_history: ${dailyData?.length || 0}`);
      if (dailyData && dailyData.length > 0) {
        dailyData.forEach((record, index) => {
          console.log(`  ${index + 1}. Model: ${record.model_id}, Amount: ${record.earnings_amount}, Date: ${record.earnings_date}`);
        });
      }
    }
    
    // 5. Verificar si hay datos en otras tablas que podrían estar causando el problema
    console.log('\n📊 [VERIFICACIÓN] 5. Verificando otras tablas...');
    
    // Verificar si hay datos en model_values con fechas de octubre
    const { data: octoberData, error: octoberError } = await supabase
      .from('model_values')
      .select('*')
      .gte('period_date', '2025-10-01')
      .lte('period_date', '2025-10-31');
    
    if (octoberError) {
      console.error('❌ Error verificando datos de octubre:', octoberError);
    } else {
      console.log(`✅ Registros en model_values para octubre: ${octoberData?.length || 0}`);
      if (octoberData && octoberData.length > 0) {
        const summary = {};
        octoberData.forEach(record => {
          const date = record.period_date;
          if (!summary[date]) {
            summary[date] = { count: 0, total: 0 };
          }
          summary[date].count++;
          summary[date].total += parseFloat(record.value || 0);
        });
        
        Object.entries(summary).forEach(([date, data]) => {
          console.log(`  📅 ${date}: ${data.count} registros, Total: $${data.total.toFixed(2)}`);
        });
      }
    }
    
    console.log('\n✅ [VERIFICACIÓN] Verificación completada');
    
  } catch (error) {
    console.error('❌ [VERIFICACIÓN] Error general:', error);
  }
}

checkAllTables();
