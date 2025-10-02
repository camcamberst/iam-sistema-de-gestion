/**
 * 🔍 TEST: Verificar base de datos con variables de entorno
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testDatabaseWithEnv() {
  try {
    console.log('🔍 [TEST] Cargando variables de entorno...');
    console.log('🔍 [TEST] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configurado' : '❌ No configurado');
    console.log('🔍 [TEST] SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurado' : '❌ No configurado');
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ [TEST] Variables de entorno no configuradas');
      return;
    }
    
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
    
    console.log('🔍 [TEST] Cliente Supabase configurado');
    
    // 1. Verificar conexión básica
    console.log('🔍 [TEST] Probando conexión...');
    const { data: testData, error: testError } = await supabase
      .from('model_values')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ [TEST] Error de conexión:', testError);
      return;
    }
    
    console.log('✅ [TEST] Conexión exitosa');
    
    // 2. Verificar estructura de tabla
    console.log('🔍 [TEST] Verificando estructura de tabla...');
    const { data: structure, error: structureError } = await supabase
      .from('model_values')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.error('❌ [TEST] Error verificando estructura:', structureError);
      return;
    }
    
    console.log('✅ [TEST] Estructura de tabla OK');
    
    // 3. Buscar valores para modelo específico
    const modelId = 'fe54995d-1828-4721-8153-53fce6f4fe56';
    const today = new Date().toISOString().split('T')[0];
    
    console.log('🔍 [TEST] Buscando valores para modelo:', modelId);
    console.log('🔍 [TEST] Fecha de búsqueda:', today);
    
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', today);
    
    if (valuesError) {
      console.error('❌ [TEST] Error obteniendo valores:', valuesError);
      return;
    }
    
    console.log('🔍 [TEST] Valores encontrados para hoy:', values?.length || 0);
    if (values && values.length > 0) {
      values.forEach((value, index) => {
        console.log(`  ${index + 1}. ${value.platform_id}: ${value.value} (${value.updated_at})`);
      });
    } else {
      console.log('⚠️ [TEST] No se encontraron valores para hoy');
    }
    
    // 4. Buscar valores recientes (últimas 24 horas)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    console.log('🔍 [TEST] Buscando valores recientes (desde:', yesterday, ')');
    
    const { data: recentValues, error: recentError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .gte('updated_at', yesterday)
      .order('updated_at', { ascending: false });
    
    if (recentError) {
      console.error('❌ [TEST] Error obteniendo valores recientes:', recentError);
      return;
    }
    
    console.log('🔍 [TEST] Valores recientes (24h):', recentValues?.length || 0);
    if (recentValues && recentValues.length > 0) {
      recentValues.forEach((value, index) => {
        console.log(`  ${index + 1}. ${value.platform_id}: ${value.value} (${value.period_date}) - ${value.updated_at}`);
      });
    } else {
      console.log('⚠️ [TEST] No se encontraron valores recientes');
    }
    
    // 5. Verificar todas las fechas disponibles
    const { data: allDates, error: datesError } = await supabase
      .from('model_values')
      .select('period_date, updated_at')
      .eq('model_id', modelId)
      .order('updated_at', { ascending: false });
    
    if (datesError) {
      console.error('❌ [TEST] Error obteniendo fechas:', datesError);
      return;
    }
    
    console.log('🔍 [TEST] Todas las fechas disponibles:', allDates?.length || 0);
    if (allDates && allDates.length > 0) {
      allDates.forEach((date, index) => {
        console.log(`  ${index + 1}. ${date.period_date} - ${date.updated_at}`);
      });
    }
    
    return {
      connection: true,
      todayValues: values?.length || 0,
      recentValues: recentValues?.length || 0,
      allDates: allDates?.length || 0
    };
    
  } catch (error) {
    console.error('❌ [TEST] Error general:', error);
    return { connection: false, error: error.message };
  }
}

// Ejecutar pruebas
testDatabaseWithEnv().then(result => {
  console.log('✅ [TEST] Pruebas completadas:', result);
}).catch(error => {
  console.error('❌ [TEST] Error ejecutando pruebas:', error);
});
