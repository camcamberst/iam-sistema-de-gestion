/**
 * 🔍 TEST: Flujo Completo de Early Freeze
 * 
 * Este script verifica:
 * 1. Si el endpoint está funcionando
 * 2. Si la lógica de detección está correcta
 * 3. Si hay problemas de sincronización
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simular funciones del endpoint
function getColombiaDate() {
  return new Date().toLocaleDateString('en-CA', { 
    timeZone: 'America/Bogota' 
  });
}

function getColombiaDateTime() {
  return new Date().toLocaleString('sv-SE', { 
    timeZone: 'America/Bogota' 
  });
}

function isClosureDay() {
  const colombiaDate = getColombiaDate();
  const day = parseInt(colombiaDate.split('-')[2]);
  return day === 1 || day === 16;
}

const EARLY_FREEZE_PLATFORMS = [
  'superfoon', 'livecreator', 'mdh', '777', 'xmodels',
  'big7', 'mondo', 'vx', 'babestation', 'dirtyfans'
];

// Función simplificada de getEuropeanCentralMidnightInColombia
function getEuropeanCentralMidnightInColombia(date) {
  // Esto es una simplificación - en producción usa la función completa
  const europeDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const colombiaTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  
  // Calcular diferencia horaria aproximada (6-7 horas según DST)
  const offset = date.getTimezoneOffset() / 60;
  const europeOffset = -1; // Europa Central es UTC+1 (invierno) o UTC+2 (verano)
  const colombiaOffset = 5; // Colombia es UTC-5
  
  // Calcular medianoche Europa Central en hora Colombia
  const europeMidnightUTC = new Date(europeDate.setHours(0, 0, 0, 0));
  const colombiaMidnight = new Date(europeMidnightUTC.getTime() - ((colombiaOffset + europeOffset) * 3600000));
  
  return {
    colombiaTime: colombiaMidnight.toLocaleTimeString('en-US', {
      timeZone: 'America/Bogota',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }),
    colombiaDate: colombiaMidnight.toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota'
    })
  };
}

async function testEarlyFreezeFlow() {
  console.log('🔍 TEST: Flujo Completo de Early Freeze\n');
  
  // 1. Verificar fecha/hora actual
  const colombiaDate = getColombiaDate();
  const colombiaDateTime = getColombiaDateTime();
  const isClosure = isClosureDay();
  
  console.log('📅 FECHA/HORA:');
  console.log(`   Colombia Date: ${colombiaDate}`);
  console.log(`   Colombia DateTime: ${colombiaDateTime}`);
  console.log(`   ¿Es día de cierre?: ${isClosure ? '✅ SÍ' : '❌ NO'}\n`);
  
  if (!isClosure) {
    console.log('⚠️  No es día de cierre, el early freeze no debería estar activo');
    console.log('   (Los días de cierre son 1 y 16 de cada mes)\n');
    return;
  }
  
  // 2. Calcular medianoche Europa Central en hora Colombia
  const now = new Date();
  const europeMidnight = getEuropeanCentralMidnightInColombia(now);
  
  console.log('🕐 HORA DE CONGELACIÓN:');
  console.log(`   Medianoche Europa Central (Colombia): ${europeMidnight.colombiaTime}`);
  console.log(`   Fecha: ${europeMidnight.colombiaDate}\n`);
  
  // 3. Verificar si ya pasó la hora
  const timePart = colombiaDateTime.split(' ')[1] || '00:00:00';
  const [currentHour, currentMinute] = timePart.split(':').map(Number);
  const [targetHour, targetMinute] = europeMidnight.colombiaTime.split(':').map(Number);
  
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  const targetTimeMinutes = targetHour * 60 + targetMinute;
  const hasPassedEarlyFreeze = currentTimeMinutes >= (targetTimeMinutes + 15);
  
  console.log('⏰ COMPARACIÓN:');
  console.log(`   Hora actual Colombia: ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`);
  console.log(`   Hora objetivo (EC midnight): ${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`);
  console.log(`   Margen: 15 minutos`);
  console.log(`   ¿Ya pasó early freeze?: ${hasPassedEarlyFreeze ? '✅ SÍ' : '❌ NO'}\n`);
  
  // 4. Obtener un modelo de prueba
  const { data: models, error: modelsError } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('role', 'modelo')
    .eq('is_active', true)
    .limit(1);
  
  if (modelsError || !models || models.length === 0) {
    console.log('❌ No hay modelos activos para probar');
    return;
  }
  
  const testModel = models[0];
  console.log('👤 MODELO DE PRUEBA:');
  console.log(`   ID: ${testModel.id}`);
  console.log(`   Email: ${testModel.email}`);
  console.log(`   Name: ${testModel.name}\n`);
  
  // 5. Verificar plataformas congeladas en BD
  const { data: frozenFromDB, error: frozenError } = await supabase
    .from('calculator_early_frozen_platforms')
    .select('platform_id')
    .eq('period_date', colombiaDate)
    .eq('model_id', testModel.id);
  
  console.log('📊 PLATAFORMAS CONGELADAS EN BD:');
  if (frozenError) {
    console.log(`   ❌ Error: ${frozenError.message}`);
  } else {
    console.log(`   Registros: ${frozenFromDB?.length || 0}`);
    if (frozenFromDB && frozenFromDB.length > 0) {
      console.log(`   Plataformas: ${frozenFromDB.map(f => f.platform_id).join(', ')}`);
    }
  }
  console.log();
  
  // 6. Simular lógica del endpoint
  const allFrozenPlatforms = new Set();
  
  // Agregar de BD
  if (frozenFromDB) {
    frozenFromDB.forEach(f => allFrozenPlatforms.add(f.platform_id.toLowerCase()));
  }
  
  // Agregar automáticamente si ya pasó la hora
  if (hasPassedEarlyFreeze) {
    console.log('🔒 APLICANDO EARLY FREEZE AUTOMÁTICO:');
    EARLY_FREEZE_PLATFORMS.forEach(platform => {
      allFrozenPlatforms.add(platform.toLowerCase());
      console.log(`   ✅ ${platform} congelada`);
    });
  }
  
  console.log('\n📋 RESULTADO FINAL:');
  console.log(`   Total plataformas congeladas: ${allFrozenPlatforms.size}`);
  console.log(`   Plataformas: ${Array.from(allFrozenPlatforms).join(', ')}\n`);
  
  // 7. Verificar si estas plataformas existen en la configuración del modelo
  const { data: modelValues, error: valuesError } = await supabase
    .from('model_values')
    .select('platform_id')
    .eq('model_id', testModel.id)
    .eq('period_date', colombiaDate);
  
  console.log('🔍 PLATAFORMAS EN CONFIGURACIÓN DEL MODELO:');
  if (valuesError) {
    console.log(`   ❌ Error: ${valuesError.message}`);
  } else {
    const configuredPlatforms = new Set(modelValues?.map(v => v.platform_id.toLowerCase()) || []);
    console.log(`   Total plataformas configuradas: ${configuredPlatforms.size}`);
    
    // Verificar intersección
    const shouldBeFrozen = EARLY_FREEZE_PLATFORMS.filter(p => 
      configuredPlatforms.has(p.toLowerCase())
    );
    
    console.log(`   Plataformas early freeze configuradas: ${shouldBeFrozen.length}`);
    console.log(`   Lista: ${shouldBeFrozen.join(', ') || 'Ninguna'}\n`);
  }
  
  // 8. Resumen
  console.log('🎯 RESUMEN:');
  if (hasPassedEarlyFreeze) {
    console.log('   ✅ Early freeze DEBERÍA estar activo');
    console.log(`   ✅ ${allFrozenPlatforms.size} plataformas deberían estar congeladas`);
  } else {
    console.log('   ⏳ Early freeze AÚN NO debería estar activo');
    console.log('   ⏳ Espera hasta pasar la medianoche Europa Central + 15 minutos');
  }
  
  console.log('\n💡 PRÓXIMOS PASOS:');
  console.log('   1. Verificar que el endpoint devuelve estas plataformas');
  console.log('   2. Verificar que la UI carga este estado');
  console.log('   3. Verificar que los inputs se deshabilitan correctamente');
}

testEarlyFreezeFlow().catch(console.error);

