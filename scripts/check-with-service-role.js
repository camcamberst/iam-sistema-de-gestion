const { createClient } = require('@supabase/supabase-js');

// Usar SERVICE_ROLE_KEY para bypass de RLS
const supabaseUrl = 'https://mhernfrkvwigxdubiozm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgxNjU0NywiZXhwIjoyMDc0MzkyNTQ3fQ.REPLACE_WITH_YOUR_ACTUAL_SERVICE_ROLE_KEY';

console.log('🔍 [CONFIG] Configuración Supabase con SERVICE_ROLE:');
console.log(`  URL: ${supabaseUrl}`);
console.log(`  Key: ${serviceRoleKey.substring(0, 20)}...`);

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkWithServiceRole() {
  try {
    const userId = 'fe54995d-1828-4721-8153-53fce6f4fe56';
    console.log(`\n🔍 [VERIFICACIÓN] Verificando datos históricos para usuario: ${userId}`);
    
    // 1. Verificar calculator_history para este usuario específico
    console.log('\n📊 [VERIFICACIÓN] 1. calculator_history para usuario específico:');
    const { data: historyData, error: historyError } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('model_id', userId)
      .order('period_date', { ascending: false })
      .order('archived_at', { ascending: false });
    
    if (historyError) {
      console.error('❌ Error en calculator_history:', historyError);
    } else {
      console.log(`✅ Registros en calculator_history para usuario: ${historyData?.length || 0}`);
      
      if (historyData && historyData.length > 0) {
        // Agrupar por período
        const summary = {};
        historyData.forEach(record => {
          const key = `${record.period_type}-${record.period_date}`;
          if (!summary[key]) {
            summary[key] = {
              period_type: record.period_type,
              period_date: record.period_date,
              count: 0,
              total: 0,
              platforms: new Set()
            };
          }
          summary[key].count++;
          summary[key].total += parseFloat(record.value || 0);
          summary[key].platforms.add(record.platform_id);
        });
        
        console.log('\n📋 Resumen por período:');
        Object.values(summary).forEach(item => {
          console.log(`  📅 ${item.period_type} - ${item.period_date}: ${item.count} registros, ${item.platforms.size} plataformas, Total: $${item.total.toFixed(2)}`);
        });
        
        // Mostrar algunos registros de ejemplo
        console.log('\n📋 Primeros 5 registros:');
        historyData.slice(0, 5).forEach((record, index) => {
          console.log(`  ${index + 1}. Platform: ${record.platform_id}, Value: ${record.value}, Period: ${record.period_type}, Date: ${record.period_date}, Archived: ${record.archived_at}`);
        });
      }
    }
    
    // 2. Verificar si hay datos del período 2 (16-31) que no deberían existir
    console.log('\n📊 [VERIFICACIÓN] 2. Verificar datos del período 2 (16-31):');
    const { data: period2Data, error: period2Error } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('model_id', userId)
      .eq('period_type', '16-31');
    
    if (period2Error) {
      console.error('❌ Error verificando período 2:', period2Error);
    } else {
      console.log(`✅ Registros del período 2 (16-31): ${period2Data?.length || 0}`);
      if (period2Data && period2Data.length > 0) {
        console.log('❌ PROBLEMA: Hay datos del período 2 que no deberían existir');
        period2Data.forEach(record => {
          console.log(`  - Platform: ${record.platform_id}, Value: ${record.value}, Date: ${record.period_date}, Archived: ${record.archived_at}`);
        });
      } else {
        console.log('✅ Correcto: No hay datos del período 2');
      }
    }
    
    // 3. Verificar datos del período 1 (1-15)
    console.log('\n📊 [VERIFICACIÓN] 3. Verificar datos del período 1 (1-15):');
    const { data: period1Data, error: period1Error } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('model_id', userId)
      .eq('period_type', '1-15');
    
    if (period1Error) {
      console.error('❌ Error verificando período 1:', period1Error);
    } else {
      console.log(`✅ Registros del período 1 (1-15): ${period1Data?.length || 0}`);
      if (period1Data && period1Data.length > 0) {
        const totalValue = period1Data.reduce((sum, record) => sum + parseFloat(record.value || 0), 0);
        console.log(`📊 Total valor período 1: $${totalValue.toFixed(2)}`);
        
        // Agrupar por fecha
        const dateSummary = {};
        period1Data.forEach(record => {
          if (!dateSummary[record.period_date]) {
            dateSummary[record.period_date] = { count: 0, total: 0 };
          }
          dateSummary[record.period_date].count++;
          dateSummary[record.period_date].total += parseFloat(record.value || 0);
        });
        
        console.log('\n📋 Resumen por fecha en período 1:');
        Object.entries(dateSummary).forEach(([date, data]) => {
          console.log(`  📅 ${date}: ${data.count} registros, Total: $${data.total.toFixed(2)}`);
        });
      }
    }
    
    console.log('\n✅ [VERIFICACIÓN] Verificación completada');
    
  } catch (error) {
    console.error('❌ [VERIFICACIÓN] Error general:', error);
  }
}

checkWithServiceRole();
