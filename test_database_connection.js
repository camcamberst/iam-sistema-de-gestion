/**
 * 🔍 TEST: Verificar conexión y datos en base de datos
 * 
 * Este script hace consultas directas a Supabase para verificar:
 * 1. Si los valores se están guardando
 * 2. Si se están cargando correctamente
 * 3. Si hay problemas de fechas o timezone
 */

const { createClient } = require('@supabase/supabase-js');

// Configurar cliente Supabase
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

async function testDatabaseConnection() {
  try {
    console.log('🔍 [TEST] Iniciando pruebas de base de datos...');
    
    // 1. Verificar conexión
    console.log('🔍 [TEST] Verificando conexión a Supabase...');
    const { data: testData, error: testError } = await supabase
      .from('model_values')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ [TEST] Error de conexión:', testError);
      return;
    }
    
    console.log('✅ [TEST] Conexión exitosa');
    
    // 2. Verificar valores para modelo específico
    const modelId = 'fe54995d-1828-4721-8153-53fce6f4fe56';
    const today = new Date().toISOString().split('T')[0];
    
    console.log('🔍 [TEST] Buscando valores para modelo:', modelId);
    console.log('🔍 [TEST] Fecha de búsqueda:', today);
    
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', today)
      .order('platform_id');
    
    if (valuesError) {
      console.error('❌ [TEST] Error obteniendo valores:', valuesError);
      return;
    }
    
    console.log('🔍 [TEST] Valores encontrados:', values?.length || 0);
    console.log('🔍 [TEST] Datos:', values);
    
    // 3. Verificar todas las fechas disponibles para este modelo
    const { data: allDates, error: datesError } = await supabase
      .from('model_values')
      .select('period_date, updated_at')
      .eq('model_id', modelId)
      .order('updated_at', { ascending: false });
    
    if (datesError) {
      console.error('❌ [TEST] Error obteniendo fechas:', datesError);
      return;
    }
    
    console.log('🔍 [TEST] Fechas disponibles:', allDates?.length || 0);
    allDates?.forEach((date, index) => {
      console.log(`  ${index + 1}. ${date.period_date} - ${date.updated_at}`);
    });
    
    // 4. Verificar valores más recientes
    const { data: recentValues, error: recentError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Últimas 24 horas
      .order('updated_at', { ascending: false });
    
    if (recentError) {
      console.error('❌ [TEST] Error obteniendo valores recientes:', recentError);
      return;
    }
    
    console.log('🔍 [TEST] Valores recientes (24h):', recentValues?.length || 0);
    recentValues?.forEach((value, index) => {
      console.log(`  ${index + 1}. ${value.platform_id}: ${value.value} (${value.period_date}) - ${value.updated_at}`);
    });
    
    return {
      connection: true,
      valuesCount: values?.length || 0,
      values: values,
      datesCount: allDates?.length || 0,
      dates: allDates,
      recentCount: recentValues?.length || 0,
      recent: recentValues
    };
    
  } catch (error) {
    console.error('❌ [TEST] Error general:', error);
    return { connection: false, error: error.message };
  }
}

// Ejecutar pruebas
testDatabaseConnection().then(result => {
  console.log('✅ [TEST] Pruebas completadas:', result);
}).catch(error => {
  console.error('❌ [TEST] Error ejecutando pruebas:', error);
});
