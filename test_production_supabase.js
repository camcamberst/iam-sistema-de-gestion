/**
 * 🔍 TEST: Análisis directo de Supabase en producción
 * 
 * Este script usa las variables de entorno del proyecto para hacer
 * consultas directas a la base de datos de producción
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testProductionSupabase() {
  try {
    console.log('🔍 [TEST] Iniciando análisis de Supabase en producción...');
    
    // Leer variables de entorno del archivo .env.local
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
    
    console.log('✅ [TEST] Cliente Supabase configurado');
    
    // 1. Verificar conexión
    console.log('\n📊 [TEST] 1. VERIFICANDO CONEXIÓN');
    const { data: testData, error: testError } = await supabase
      .from('model_values')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ [TEST] Error de conexión:', testError);
      return;
    }
    
    console.log('✅ [TEST] Conexión exitosa');
    
    // 2. Buscar valores para modelo específico
    const modelId = 'fe54995d-1828-4721-8153-53fce6f4fe56';
    const today = new Date().toISOString().split('T')[0];
    
    console.log('\n📊 [TEST] 2. BUSCANDO VALORES PARA MODELO');
    console.log('Modelo ID:', modelId);
    console.log('Fecha hoy:', today);
    
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', today)
      .order('updated_at', { ascending: false });
    
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
    }
    
    // 3. Buscar valores recientes (últimas 2 horas)
    console.log('\n📊 [TEST] 3. BUSCANDO VALORES RECIENTES (2 HORAS)');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: recentValues, error: recentError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .gte('updated_at', twoHoursAgo)
      .order('updated_at', { ascending: false });
    
    if (recentError) {
      console.error('❌ [TEST] Error obteniendo valores recientes:', recentError);
      return;
    }
    
    console.log('🔍 [TEST] Valores recientes (2h):', recentValues?.length || 0);
    if (recentValues && recentValues.length > 0) {
      console.log('📊 [TEST] Datos recientes:');
      recentValues.forEach((value, index) => {
        const timeAgo = Math.round((Date.now() - new Date(value.updated_at).getTime()) / 1000 / 60);
        console.log(`  ${index + 1}. ${value.platform_id}: ${value.value} (${value.period_date}) - ${timeAgo}min ago`);
      });
    } else {
      console.log('⚠️ [TEST] No se encontraron valores recientes');
    }
    
    // 4. Buscar todas las fechas disponibles
    console.log('\n📊 [TEST] 4. BUSCANDO TODAS LAS FECHAS DISPONIBLES');
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
    if (allDates && allDates.length > 0) {
      // Agrupar por fecha
      const dateGroups = {};
      allDates.forEach(date => {
        if (!dateGroups[date.period_date]) {
          dateGroups[date.period_date] = [];
        }
        dateGroups[date.period_date].push(date.updated_at);
      });
      
      console.log('📊 [TEST] Fechas agrupadas:');
      Object.keys(dateGroups).forEach(date => {
        const count = dateGroups[date].length;
        const lastUpdate = dateGroups[date][0];
        console.log(`  ${date}: ${count} valores (último: ${lastUpdate})`);
      });
    }
    
    // 5. Análisis de timezone
    console.log('\n📊 [TEST] 5. ANÁLISIS DE TIMEZONE');
    const now = new Date();
    const europeDate = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Berlin"}));
    const colombiaDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
    
    console.log('🕐 [TEST] Fechas de referencia:');
    console.log(`  Servidor (UTC): ${now.toISOString().split('T')[0]}`);
    console.log(`  Europa Central: ${europeDate.toISOString().split('T')[0]}`);
    console.log(`  Colombia: ${colombiaDate.toISOString().split('T')[0]}`);
    
    return {
      connection: true,
      todayValues: values?.length || 0,
      recentValues: recentValues?.length || 0,
      allDates: allDates?.length || 0,
      timezone: {
        server: now.toISOString().split('T')[0],
        europe: europeDate.toISOString().split('T')[0],
        colombia: colombiaDate.toISOString().split('T')[0]
      }
    };
    
  } catch (error) {
    console.error('❌ [TEST] Error general:', error);
    return { connection: false, error: error.message };
  }
}

// Ejecutar análisis
testProductionSupabase().then(result => {
  console.log('\n✅ [TEST] Análisis completado:', result);
}).catch(error => {
  console.error('❌ [TEST] Error ejecutando análisis:', error);
});
