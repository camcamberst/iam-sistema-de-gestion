/**
 * Script para forzar la limpieza de TODOS los valores del período 1-15 de noviembre
 * Incluye verificación exhaustiva y limpieza directa en la base de datos
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

async function forceCleanup() {
  try {
    console.log('🧹 [FORCE-CLEANUP] Iniciando limpieza forzada del período 1-15 de noviembre...');
    
    // Rango completo del período 1-15 de noviembre
    const startDate = '2025-11-01';
    const endDate = '2025-11-15';
    
    console.log(`📅 [FORCE-CLEANUP] Rango: ${startDate} a ${endDate}`);
    
    // PASO 1: Verificar TODOS los valores en el rango
    const { data: allValues, error: checkError } = await supabase
      .from('model_values')
      .select('*')
      .gte('period_date', startDate)
      .lte('period_date', endDate);
    
    if (checkError) {
      console.error('❌ [FORCE-CLEANUP] Error verificando valores:', checkError);
      return;
    }
    
    console.log(`🔍 [FORCE-CLEANUP] Valores encontrados: ${allValues?.length || 0}`);
    
    if (allValues && allValues.length > 0) {
      console.log('\n📊 [FORCE-CLEANUP] Detalle de valores encontrados:');
      
      // Agrupar por fecha
      const byDate = {};
      allValues.forEach(v => {
        if (!byDate[v.period_date]) {
          byDate[v.period_date] = [];
        }
        byDate[v.period_date].push(v);
      });
      
      Object.keys(byDate).sort().forEach(date => {
        console.log(`   ${date}: ${byDate[date].length} valores`);
      });
      
      // Agrupar por modelo
      const byModel = {};
      allValues.forEach(v => {
        if (!byModel[v.model_id]) {
          byModel[v.model_id] = [];
        }
        byModel[v.model_id].push(v);
      });
      
      console.log(`\n👤 [FORCE-CLEANUP] Valores por modelo: ${Object.keys(byModel).length} modelos`);
      Object.keys(byModel).slice(0, 10).forEach(modelId => {
        console.log(`   ${modelId.substring(0, 8)}...: ${byModel[modelId].length} valores`);
      });
      
      // PASO 2: Eliminar TODOS los valores del rango
      console.log('\n🗑️ [FORCE-CLEANUP] Eliminando valores...');
      
      const { data: deleted, error: deleteError } = await supabase
        .from('model_values')
        .delete()
        .gte('period_date', startDate)
        .lte('period_date', endDate)
        .select();
      
      if (deleteError) {
        console.error('❌ [FORCE-CLEANUP] Error eliminando valores:', deleteError);
        console.error('   Detalles:', JSON.stringify(deleteError, null, 2));
        return;
      }
      
      console.log(`✅ [FORCE-CLEANUP] ${deleted?.length || 0} valores eliminados`);
      
      // PASO 3: Verificar que se eliminaron
      const { data: remaining, error: verifyError } = await supabase
        .from('model_values')
        .select('id')
        .gte('period_date', startDate)
        .lte('period_date', endDate);
      
      if (verifyError) {
        console.error('⚠️ [FORCE-CLEANUP] Error verificando:', verifyError);
      } else {
        const remainingCount = remaining?.length || 0;
        if (remainingCount > 0) {
          console.log(`⚠️ [FORCE-CLEANUP] AÚN QUEDAN ${remainingCount} valores. Puede ser un problema de RLS.`);
          console.log('   Intentando eliminación directa por IDs...');
          
          // Intentar eliminar por IDs individuales
          const ids = remaining.map(r => r.id);
          for (let i = 0; i < ids.length; i += 100) {
            const batch = ids.slice(i, i + 100);
            const { error: batchError } = await supabase
              .from('model_values')
              .delete()
              .in('id', batch);
            
            if (batchError) {
              console.error(`   ❌ Error eliminando lote ${i}-${i + batch.length}:`, batchError);
            } else {
              console.log(`   ✅ Lote ${i}-${i + batch.length} eliminado`);
            }
          }
        } else {
          console.log('✅ [FORCE-CLEANUP] Todos los valores fueron eliminados exitosamente');
        }
      }
    } else {
      console.log('✅ [FORCE-CLEANUP] No hay valores para eliminar');
    }
    
    // PASO 4: Verificar también valores de días específicos que puedan estar causando problemas
    console.log('\n🔍 [FORCE-CLEANUP] Verificando días específicos del período:');
    for (let day = 1; day <= 15; day++) {
      const date = `2025-11-${String(day).padStart(2, '0')}`;
      const { data: dayValues } = await supabase
        .from('model_values')
        .select('id')
        .eq('period_date', date);
      
      if (dayValues && dayValues.length > 0) {
        console.log(`   ⚠️ ${date}: ${dayValues.length} valores encontrados`);
        
        // Eliminar estos valores
        const { error: dayDeleteError } = await supabase
          .from('model_values')
          .delete()
          .eq('period_date', date);
        
        if (dayDeleteError) {
          console.log(`     ❌ Error eliminando: ${dayDeleteError.message}`);
        } else {
          console.log(`     ✅ Eliminados`);
        }
      }
    }
    
    console.log('\n✅ [FORCE-CLEANUP] Limpieza completada');
    
  } catch (error) {
    console.error('❌ [FORCE-CLEANUP] Error general:', error);
  }
}

forceCleanup();



