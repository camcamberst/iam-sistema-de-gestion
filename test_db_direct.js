/**
 * 🔍 TEST: Verificar base de datos con variables directas
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testDBDirect() {
  try {
    console.log('🔍 [TEST] Leyendo variables de entorno...');
    
    // Leer archivo .env.local si existe
    let envContent = '';
    try {
      envContent = fs.readFileSync('.env.local', 'utf8');
      console.log('✅ [TEST] Archivo .env.local encontrado');
    } catch (error) {
      console.log('⚠️ [TEST] Archivo .env.local no encontrado, usando variables del sistema');
    }
    
    // Extraer variables del contenido
    const lines = envContent.split('\n');
    let supabaseUrl = '';
    let serviceKey = '';
    
    lines.forEach(line => {
      if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        supabaseUrl = line.split('=')[1];
      }
      if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        serviceKey = line.split('=')[1];
      }
    });
    
    // Si no se encontraron en el archivo, usar variables del sistema
    if (!supabaseUrl) {
      supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (!serviceKey) {
      serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    
    console.log('🔍 [TEST] URL:', supabaseUrl ? '✅ Configurado' : '❌ No configurado');
    console.log('🔍 [TEST] Service Key:', serviceKey ? '✅ Configurado' : '❌ No configurado');
    
    if (!supabaseUrl || !serviceKey) {
      console.error('❌ [TEST] Variables de entorno no configuradas');
      console.log('💡 [TEST] Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
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
    
    console.log('🔍 [TEST] Valores encontrados para hoy:', values?.length || 0);
    
    if (values && values.length > 0) {
      console.log('📊 [TEST] Datos encontrados:');
      values.forEach((value, index) => {
        console.log(`  ${index + 1}. ${value.platform_id}: ${value.value} (${value.updated_at})`);
      });
    } else {
      console.log('⚠️ [TEST] No se encontraron valores para hoy');
      
      // Buscar en todas las fechas
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
        console.log('📊 [TEST] Datos encontrados:');
        allValues.forEach((value, index) => {
          console.log(`  ${index + 1}. ${value.platform_id}: ${value.value} (${value.period_date}) - ${value.updated_at}`);
        });
      } else {
        console.log('⚠️ [TEST] No se encontraron valores para este modelo');
      }
    }
    
    return {
      connection: true,
      todayValues: values?.length || 0,
      allValues: allValues?.length || 0
    };
    
  } catch (error) {
    console.error('❌ [TEST] Error general:', error);
    return { connection: false, error: error.message };
  }
}

// Ejecutar pruebas
testDBDirect().then(result => {
  console.log('✅ [TEST] Pruebas completadas:', result);
}).catch(error => {
  console.error('❌ [TEST] Error ejecutando pruebas:', error);
});
