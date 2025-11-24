/**
 * Script para verificar qué valores hay actualmente en model_values
 * para entender por qué Mi Calculadora sigue mostrando valores
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

async function checkCurrentValues() {
  try {
    console.log('🔍 [CHECK] Verificando valores actuales en model_values...');
    
    // Obtener todos los valores de noviembre 2025
    const { data: novValues, error: novError } = await supabase
      .from('model_values')
      .select('id, model_id, platform_id, period_date, value, updated_at')
      .gte('period_date', '2025-11-01')
      .lte('period_date', '2025-11-30')
      .order('period_date', { ascending: true })
      .order('model_id', { ascending: true });
    
    if (novError) {
      console.error('❌ [CHECK] Error obteniendo valores de noviembre:', novError);
      return;
    }
    
    console.log(`📊 [CHECK] Valores encontrados en noviembre: ${novValues?.length || 0}`);
    
    if (novValues && novValues.length > 0) {
      // Agrupar por fecha
      const byDate = {};
      novValues.forEach(v => {
        if (!byDate[v.period_date]) {
          byDate[v.period_date] = [];
        }
        byDate[v.period_date].push(v);
      });
      
      console.log('\n📅 [CHECK] Valores por fecha:');
      Object.keys(byDate).sort().forEach(date => {
        console.log(`   ${date}: ${byDate[date].length} valores`);
      });
      
      // Agrupar por modelo
      const byModel = {};
      novValues.forEach(v => {
        if (!byModel[v.model_id]) {
          byModel[v.model_id] = [];
        }
        byModel[v.model_id].push(v);
      });
      
      console.log('\n👤 [CHECK] Valores por modelo (primeros 5):');
      const modelIds = Object.keys(byModel).slice(0, 5);
      modelIds.forEach(modelId => {
        const values = byModel[modelId];
        const dates = [...new Set(values.map(v => v.period_date))];
        console.log(`   Modelo ${modelId.substring(0, 8)}...: ${values.length} valores en fechas: ${dates.join(', ')}`);
      });
    }
    
    // Verificar también valores de octubre que puedan estar causando confusión
    const { data: octValues, error: octError } = await supabase
      .from('model_values')
      .select('id, model_id, platform_id, period_date, value')
      .gte('period_date', '2025-10-16')
      .lte('period_date', '2025-10-31')
      .limit(10);
    
    if (!octError && octValues && octValues.length > 0) {
      console.log(`\n⚠️ [CHECK] También hay ${octValues.length} valores del período 16-31 de octubre (mostrando primeros 10)`);
    }
    
    // Verificar la fecha actual de Colombia para saber qué período debería estar activo
    const today = new Date();
    const colombiaDate = today.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const day = parseInt(colombiaDate.split('-')[2]);
    const currentPeriod = day >= 1 && day <= 15 ? '1-15' : '16-31';
    
    console.log(`\n📅 [CHECK] Fecha actual Colombia: ${colombiaDate}`);
    console.log(`📅 [CHECK] Período actual esperado: ${currentPeriod}`);
    console.log(`📅 [CHECK] Fecha de referencia para cargar valores: ${colombiaDate}`);
    
    // Verificar qué valores hay para la fecha actual
    const { data: todayValues, error: todayError } = await supabase
      .from('model_values')
      .select('id, model_id, platform_id, period_date, value')
      .eq('period_date', colombiaDate)
      .limit(20);
    
    if (!todayError && todayValues && todayValues.length > 0) {
      console.log(`\n📊 [CHECK] Valores para fecha actual (${colombiaDate}): ${todayValues.length} encontrados`);
      console.log('   Primeros valores:');
      todayValues.slice(0, 5).forEach(v => {
        console.log(`     - Modelo ${v.model_id.substring(0, 8)}..., Plataforma ${v.platform_id}, Valor: ${v.value}`);
      });
    } else {
      console.log(`\n✅ [CHECK] No hay valores para la fecha actual (${colombiaDate})`);
    }
    
  } catch (error) {
    console.error('❌ [CHECK] Error general:', error);
  }
}

checkCurrentValues();



