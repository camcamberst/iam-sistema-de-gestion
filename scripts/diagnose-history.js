const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Variables de entorno directas
const supabase = createClient(
  'https://mhernfrkvwigxdubiozm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c'
);

async function runDiagnosis() {
  try {
    console.log('🔍 [DIAGNÓSTICO] Ejecutando diagnóstico de calculator_history...');
    
    // 1. Verificar todos los datos en calculator_history
    console.log('\n📊 [DIAGNÓSTICO] 1. Todos los datos en calculator_history:');
    const { data: allData, error: allError } = await supabase
      .from('calculator_history')
      .select('*')
      .order('archived_at', { ascending: false });
    
    if (allError) {
      console.error('❌ Error obteniendo todos los datos:', allError);
    } else {
      console.log(`✅ Total registros: ${allData?.length || 0}`);
      if (allData && allData.length > 0) {
        console.log('📋 Primeros 5 registros:');
        allData.slice(0, 5).forEach((record, index) => {
          console.log(`  ${index + 1}. Model: ${record.model_id}, Platform: ${record.platform_id}, Value: ${record.value}, Period: ${record.period_type}, Date: ${record.period_date}`);
        });
      }
    }
    
    // 2. Resumen por período
    console.log('\n📊 [DIAGNÓSTICO] 2. Resumen por período:');
    const { data: summaryData, error: summaryError } = await supabase
      .from('calculator_history')
      .select('period_type, period_date, value, model_id, platform_id');
    
    if (summaryError) {
      console.error('❌ Error obteniendo resumen:', summaryError);
    } else {
      const summary = {};
      summaryData?.forEach(record => {
        const key = `${record.period_type}-${record.period_date}`;
        if (!summary[key]) {
          summary[key] = {
            period_type: record.period_type,
            period_date: record.period_date,
            registros: 0,
            modelos: new Set(),
            plataformas: new Set(),
            total_valor: 0
          };
        }
        summary[key].registros++;
        summary[key].modelos.add(record.model_id);
        summary[key].plataformas.add(record.platform_id);
        summary[key].total_valor += parseFloat(record.value || 0);
      });
      
      Object.values(summary).forEach(item => {
        console.log(`  📅 ${item.period_type} - ${item.period_date}: ${item.registros} registros, ${item.modelos.size} modelos, ${item.plataformas.size} plataformas, Total: $${item.total_valor.toFixed(2)}`);
      });
    }
    
    // 3. Verificar datos del período 2 (16-31)
    console.log('\n📊 [DIAGNÓSTICO] 3. Datos del período 2 (16-31) - NO DEBERÍAN EXISTIR:');
    const { data: period2Data, error: period2Error } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('period_type', '16-31');
    
    if (period2Error) {
      console.error('❌ Error obteniendo datos período 2:', period2Error);
    } else {
      console.log(`✅ Registros del período 2: ${period2Data?.length || 0}`);
      if (period2Data && period2Data.length > 0) {
        console.log('❌ PROBLEMA: Hay datos del período 2 que no deberían existir');
        period2Data.forEach(record => {
          console.log(`  - Model: ${record.model_id}, Platform: ${record.platform_id}, Value: ${record.value}, Date: ${record.period_date}`);
        });
      } else {
        console.log('✅ Correcto: No hay datos del período 2');
      }
    }
    
    // 4. Verificar duplicados
    console.log('\n📊 [DIAGNÓSTICO] 4. Verificar duplicados:');
    const { data: duplicatesData, error: duplicatesError } = await supabase
      .from('calculator_history')
      .select('model_id, platform_id, period_date, period_type, value, archived_at');
    
    if (duplicatesError) {
      console.error('❌ Error verificando duplicados:', duplicatesError);
    } else {
      const duplicates = {};
      duplicatesData?.forEach(record => {
        const key = `${record.model_id}-${record.platform_id}-${record.period_date}-${record.period_type}`;
        if (!duplicates[key]) {
          duplicates[key] = [];
        }
        duplicates[key].push(record);
      });
      
      const duplicateKeys = Object.keys(duplicates).filter(key => duplicates[key].length > 1);
      console.log(`✅ Registros con duplicados: ${duplicateKeys.length}`);
      
      if (duplicateKeys.length > 0) {
        console.log('❌ PROBLEMA: Hay registros duplicados');
        duplicateKeys.slice(0, 3).forEach(key => {
          console.log(`  - ${key}: ${duplicates[key].length} registros`);
        });
      } else {
        console.log('✅ Correcto: No hay duplicados');
      }
    }
    
    console.log('\n✅ [DIAGNÓSTICO] Diagnóstico completado');
    
  } catch (error) {
    console.error('❌ [DIAGNÓSTICO] Error general:', error);
  }
}

runDiagnosis();
