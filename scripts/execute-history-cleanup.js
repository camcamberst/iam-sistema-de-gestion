const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Usar la misma configuración que el frontend
const supabase = createClient(
  'https://mhernfrkvwigxdubiozm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c'
);

async function executeHistoryCleanup() {
  try {
    console.log('🔍 [LIMPIEZA] Iniciando limpieza de datos incorrectos del historial...');
    
    // 0. Verificar estado ANTES de la limpieza
    console.log('\n📊 [LIMPIEZA] 0. Verificando estado ANTES de la limpieza:');
    const { data: beforeData, error: beforeError } = await supabase
      .from('calculator_history')
      .select('period_type, value, model_id');
    
    if (beforeError) {
      console.error('❌ Error obteniendo datos antes de limpieza:', beforeError);
      return;
    }
    
    const beforeSummary = {};
    beforeData?.forEach(record => {
      if (!beforeSummary[record.period_type]) {
        beforeSummary[record.period_type] = {
          registros: 0,
          modelos: new Set(),
          total_valor: 0
        };
      }
      beforeSummary[record.period_type].registros++;
      beforeSummary[record.period_type].modelos.add(record.model_id);
      beforeSummary[record.period_type].total_valor += parseFloat(record.value || 0);
    });
    
    Object.entries(beforeSummary).forEach(([period, data]) => {
      console.log(`  📅 ${period}: ${data.registros} registros, ${data.modelos.size} modelos, Total: $${data.total_valor.toFixed(2)}`);
    });
    
    // 1. Verificar datos específicos del usuario problemático
    console.log('\n📊 [LIMPIEZA] 1. Verificando datos del usuario específico:');
    const { data: userData, error: userError } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('model_id', 'fe54995d-1828-4721-8153-53fce6f4fe56')
      .order('period_date', { ascending: false });
    
    if (userError) {
      console.error('❌ Error obteniendo datos del usuario:', userError);
      return;
    }
    
    console.log(`✅ Registros del usuario específico: ${userData?.length || 0}`);
    
    if (userData && userData.length > 0) {
      const userSummary = {};
      userData.forEach(record => {
        const key = `${record.period_type}-${record.period_date}`;
        if (!userSummary[key]) {
          userSummary[key] = {
            period_type: record.period_type,
            period_date: record.period_date,
            registros: 0,
            plataformas: new Set(),
            total_valor: 0
          };
        }
        userSummary[key].registros++;
        userSummary[key].plataformas.add(record.platform_id);
        userSummary[key].total_valor += parseFloat(record.value || 0);
      });
      
      Object.values(userSummary).forEach(item => {
        console.log(`  📅 ${item.period_type} - ${item.period_date}: ${item.registros} registros, ${item.plataformas.size} plataformas, Total: $${item.total_valor.toFixed(2)}`);
      });
    }
    
    // 2. Eliminar datos del período 2 (16-31) que no deberían existir
    console.log('\n📊 [LIMPIEZA] 2. Eliminando datos del período 2 (16-31):');
    const { data: period2Data, error: period2Error } = await supabase
      .from('calculator_history')
      .select('id')
      .eq('period_type', '16-31');
    
    if (period2Error) {
      console.error('❌ Error obteniendo datos del período 2:', period2Error);
    } else {
      console.log(`✅ Registros del período 2 encontrados: ${period2Data?.length || 0}`);
      
      if (period2Data && period2Data.length > 0) {
        // Eliminar en lotes para evitar problemas de tamaño
        const batchSize = 50;
        for (let i = 0; i < period2Data.length; i += batchSize) {
          const batch = period2Data.slice(i, i + batchSize);
          const ids = batch.map(record => record.id);
          
          const { error: deleteError } = await supabase
            .from('calculator_history')
            .delete()
            .in('id', ids);
          
          if (deleteError) {
            console.error(`❌ Error eliminando lote ${i}-${i + batch.length}:`, deleteError);
          } else {
            console.log(`✅ Lote ${i}-${i + batch.length} eliminado correctamente`);
          }
        }
      }
    }
    
    // 3. Verificar duplicados en el período 1
    console.log('\n📊 [LIMPIEZA] 3. Verificando duplicados en período 1:');
    const { data: period1Data, error: period1Error } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('period_type', '1-15')
      .order('archived_at', { ascending: false });
    
    if (period1Error) {
      console.error('❌ Error obteniendo datos del período 1:', period1Error);
    } else {
      console.log(`✅ Registros del período 1: ${period1Data?.length || 0}`);
      
      if (period1Data && period1Data.length > 0) {
        // Identificar duplicados
        const duplicates = {};
        period1Data.forEach(record => {
          const key = `${record.model_id}-${record.platform_id}-${record.period_date}`;
          if (!duplicates[key]) {
            duplicates[key] = [];
          }
          duplicates[key].push(record);
        });
        
        const duplicateKeys = Object.keys(duplicates).filter(key => duplicates[key].length > 1);
        console.log(`✅ Registros con duplicados encontrados: ${duplicateKeys.length}`);
        
        if (duplicateKeys.length > 0) {
          // Eliminar duplicados (mantener solo el más reciente)
          for (const key of duplicateKeys) {
            const records = duplicates[key];
            const sortedRecords = records.sort((a, b) => new Date(b.archived_at) - new Date(a.archived_at));
            const toDelete = sortedRecords.slice(1); // Mantener solo el primero (más reciente)
            
            const idsToDelete = toDelete.map(record => record.id);
            
            const { error: deleteError } = await supabase
              .from('calculator_history')
              .delete()
              .in('id', idsToDelete);
            
            if (deleteError) {
              console.error(`❌ Error eliminando duplicados para ${key}:`, deleteError);
            } else {
              console.log(`✅ Duplicados eliminados para ${key}: ${toDelete.length} registros`);
            }
          }
        }
      }
    }
    
    // 4. Verificar estado DESPUÉS de la limpieza
    console.log('\n📊 [LIMPIEZA] 4. Verificando estado DESPUÉS de la limpieza:');
    const { data: afterData, error: afterError } = await supabase
      .from('calculator_history')
      .select('period_type, value, model_id');
    
    if (afterError) {
      console.error('❌ Error obteniendo datos después de limpieza:', afterError);
      return;
    }
    
    const afterSummary = {};
    afterData?.forEach(record => {
      if (!afterSummary[record.period_type]) {
        afterSummary[record.period_type] = {
          registros: 0,
          modelos: new Set(),
          total_valor: 0
        };
      }
      afterSummary[record.period_type].registros++;
      afterSummary[record.period_type].modelos.add(record.model_id);
      afterSummary[record.period_type].total_valor += parseFloat(record.value || 0);
    });
    
    Object.entries(afterSummary).forEach(([period, data]) => {
      console.log(`  📅 ${period}: ${data.registros} registros, ${data.modelos.size} modelos, Total: $${data.total_valor.toFixed(2)}`);
    });
    
    // 5. Verificar que no quedan datos del período 2
    console.log('\n📊 [LIMPIEZA] 5. Verificando que no quedan datos del período 2:');
    const { data: period2Check, error: period2CheckError } = await supabase
      .from('calculator_history')
      .select('id')
      .eq('period_type', '16-31');
    
    if (period2CheckError) {
      console.error('❌ Error verificando período 2:', period2CheckError);
    } else {
      console.log(`✅ Registros del período 2 restantes: ${period2Check?.length || 0}`);
      if (period2Check && period2Check.length === 0) {
        console.log('✅ Correcto: No quedan datos del período 2');
      } else {
        console.log('❌ PROBLEMA: Aún quedan datos del período 2');
      }
    }
    
    console.log('\n✅ [LIMPIEZA] Limpieza completada');
    
  } catch (error) {
    console.error('❌ [LIMPIEZA] Error general:', error);
  }
}

executeHistoryCleanup();
