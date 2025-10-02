/**
 * 🔍 TEST: Consultas directas a Supabase para analizar flujo real de datos
 * 
 * Este script hace consultas directas a la base de datos de producción
 * para verificar el flujo real de datos entre Mi Calculadora y Supabase
 */

const { createClient } = require('@supabase/supabase-js');

async function testSupabaseDirect() {
  try {
    console.log('🔍 [TEST] Iniciando análisis directo de Supabase...');
    
    // Configurar cliente con service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
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
    
    // 1. Verificar estructura de tabla
    console.log('\n📊 [TEST] 1. VERIFICANDO ESTRUCTURA DE TABLA');
    const { data: structure, error: structureError } = await supabase
      .from('model_values')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.error('❌ [TEST] Error verificando estructura:', structureError);
      return;
    }
    
    console.log('✅ [TEST] Estructura de tabla OK');
    
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
    
    // 5. Verificar si hay valores duplicados
    console.log('\n📊 [TEST] 5. VERIFICANDO DUPLICADOS');
    const { data: duplicates, error: duplicatesError } = await supabase
      .from('model_values')
      .select('platform_id, period_date, COUNT(*) as count')
      .eq('model_id', modelId)
      .group('platform_id, period_date')
      .having('COUNT(*) > 1');
    
    if (duplicatesError) {
      console.error('❌ [TEST] Error verificando duplicados:', duplicatesError);
    } else {
      console.log('🔍 [TEST] Duplicados encontrados:', duplicates?.length || 0);
      if (duplicates && duplicates.length > 0) {
        console.log('⚠️ [TEST] DUPLICADOS DETECTADOS:');
        duplicates.forEach((dup, index) => {
          console.log(`  ${index + 1}. ${dup.platform_id} (${dup.period_date}): ${dup.count} registros`);
        });
      }
    }
    
    // 6. Análisis de timezone
    console.log('\n📊 [TEST] 6. ANÁLISIS DE TIMEZONE');
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
      duplicates: duplicates?.length || 0,
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
testSupabaseDirect().then(result => {
  console.log('\n✅ [TEST] Análisis completado:', result);
}).catch(error => {
  console.error('❌ [TEST] Error ejecutando análisis:', error);
});
