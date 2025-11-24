/**
 * Script para limpiar manualmente todos los valores del período 1-15 de noviembre
 * de todas las calculadoras de modelos
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

async function cleanupNov1_15Values() {
  try {
    console.log('🧹 [CLEANUP] Iniciando limpieza de valores del período 1-15 de noviembre...');
    
    // Rango del período 1-15 de noviembre
    const startDate = '2025-11-01';
    const endDate = '2025-11-15';
    
    console.log(`📅 [CLEANUP] Rango: ${startDate} a ${endDate}`);
    
    // Primero, verificar cuántos valores hay
    const { data: existingValues, error: checkError } = await supabase
      .from('model_values')
      .select('id, model_id, platform_id, period_date, value')
      .gte('period_date', startDate)
      .lte('period_date', endDate);
    
    if (checkError) {
      console.error('❌ [CLEANUP] Error verificando valores:', checkError);
      return;
    }
    
    console.log(`🔍 [CLEANUP] Encontrados ${existingValues?.length || 0} valores en el rango`);
    
    if (!existingValues || existingValues.length === 0) {
      console.log('✅ [CLEANUP] No hay valores para eliminar');
      return;
    }
    
    // Agrupar por modelo para mostrar resumen
    const byModel = {};
    existingValues.forEach(v => {
      if (!byModel[v.model_id]) {
        byModel[v.model_id] = [];
      }
      byModel[v.model_id].push(v);
    });
    
    console.log(`📊 [CLEANUP] Valores por modelo:`);
    Object.keys(byModel).forEach(modelId => {
      console.log(`   - Modelo ${modelId}: ${byModel[modelId].length} valores`);
    });
    
    // Eliminar todos los valores del rango
    const { data: deleted, error: deleteError } = await supabase
      .from('model_values')
      .delete()
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .select();
    
    if (deleteError) {
      console.error('❌ [CLEANUP] Error eliminando valores:', deleteError);
      return;
    }
    
    console.log(`✅ [CLEANUP] ${deleted?.length || 0} valores eliminados exitosamente`);
    
    // Verificar que se eliminaron
    const { data: remainingValues, error: verifyError } = await supabase
      .from('model_values')
      .select('id')
      .gte('period_date', startDate)
      .lte('period_date', endDate);
    
    if (verifyError) {
      console.error('⚠️ [CLEANUP] Error verificando eliminación:', verifyError);
    } else {
      console.log(`🔍 [CLEANUP] Valores restantes: ${remainingValues?.length || 0}`);
      if (remainingValues && remainingValues.length > 0) {
        console.log('⚠️ [CLEANUP] Aún quedan valores. Puede haber un problema de permisos RLS.');
      } else {
        console.log('✅ [CLEANUP] Limpieza completada exitosamente');
      }
    }
    
  } catch (error) {
    console.error('❌ [CLEANUP] Error general:', error);
  }
}

cleanupNov1_15Values();



