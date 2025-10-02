/**
 * 🔍 TEST: Verificar base de datos - versión simple
 */

const { createClient } = require('@supabase/supabase-js');

async function testSimpleDB() {
  try {
    // Usar variables de entorno directamente (configuradas en el sistema)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';
    
    console.log('🔍 [TEST] Configurando cliente Supabase...');
    console.log('🔍 [TEST] URL:', supabaseUrl ? '✅ Configurado' : '❌ No configurado');
    console.log('🔍 [TEST] Service Key:', serviceKey ? '✅ Configurado' : '❌ No configurado');
    
    if (supabaseUrl === 'https://your-project.supabase.co' || serviceKey === 'your-service-key') {
      console.error('❌ [TEST] Variables de entorno no configuradas correctamente');
      console.log('💡 [TEST] Asegúrate de que NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY estén configuradas');
      return;
    }
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('🔍 [TEST] Probando conexión...');
    
    // Test básico de conexión
    const { data, error } = await supabase
      .from('model_values')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ [TEST] Error de conexión:', error);
      return;
    }
    
    console.log('✅ [TEST] Conexión exitosa');
    
    // Buscar valores para modelo específico
    const modelId = 'fe54995d-1828-4721-8153-53fce6f4fe56';
    const today = new Date().toISOString().split('T')[0];
    
    console.log('🔍 [TEST] Buscando valores para modelo:', modelId);
    console.log('🔍 [TEST] Fecha:', today);
    
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', today);
    
    if (valuesError) {
      console.error('❌ [TEST] Error obteniendo valores:', valuesError);
      return;
    }
    
    console.log('🔍 [TEST] Valores encontrados:', values?.length || 0);
    
    if (values && values.length > 0) {
      console.log('📊 [TEST] Datos encontrados:');
      values.forEach((value, index) => {
        console.log(`  ${index + 1}. ${value.platform_id}: ${value.value} (${value.updated_at})`);
      });
    } else {
      console.log('⚠️ [TEST] No se encontraron valores para hoy');
      
      // Buscar en otras fechas
      console.log('🔍 [TEST] Buscando en todas las fechas...');
      const { data: allValues, error: allError } = await supabase
        .from('model_values')
        .select('*')
        .eq('model_id', modelId)
        .order('updated_at', { ascending: false });
      
      if (allError) {
        console.error('❌ [TEST] Error obteniendo todos los valores:', allError);
        return;
      }
      
      console.log('🔍 [TEST] Valores en todas las fechas:', allValues?.length || 0);
      if (allValues && allValues.length > 0) {
        allValues.forEach((value, index) => {
          console.log(`  ${index + 1}. ${value.platform_id}: ${value.value} (${value.period_date}) - ${value.updated_at}`);
        });
      }
    }
    
    return {
      connection: true,
      valuesFound: values?.length || 0,
      values: values
    };
    
  } catch (error) {
    console.error('❌ [TEST] Error general:', error);
    return { connection: false, error: error.message };
  }
}

// Ejecutar pruebas
testSimpleDB().then(result => {
  console.log('✅ [TEST] Pruebas completadas:', result);
}).catch(error => {
  console.error('❌ [TEST] Error ejecutando pruebas:', error);
});
