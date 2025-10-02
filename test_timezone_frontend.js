/**
 * 🔍 TEST: Verificar timezone en frontend
 * 
 * Este script verifica cómo se está manejando el timezone
 * en el frontend de la calculadora
 */

function testTimezoneFrontend() {
  console.log('🔍 [TIMEZONE] Iniciando análisis de timezone en frontend...');
  
  // 1. Verificar timezone del navegador
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log('🌍 [TIMEZONE] Timezone del navegador:', browserTimezone);
  
  // 2. Verificar fecha actual en diferentes timezones
  const now = new Date();
  const utcDate = now.toISOString();
  const colombiaDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const europeDate = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
  
  console.log('🕐 [TIMEZONE] Fechas de referencia:');
  console.log('  UTC:', utcDate);
  console.log('  Colombia:', colombiaDate);
  console.log('  Europa Central:', europeDate);
  
  // 3. Simular getCalculatorDate()
  const getCalculatorDate = () => {
    return new Date().toLocaleDateString('en-CA', { 
      timeZone: 'Europe/Berlin' 
    });
  };
  
  const calculatorDate = getCalculatorDate();
  console.log('📅 [TIMEZONE] getCalculatorDate():', calculatorDate);
  
  // 4. Verificar diferencia de horas
  const colombiaTime = new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' });
  const europeTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' });
  
  console.log('⏰ [TIMEZONE] Horas actuales:');
  console.log('  Colombia:', colombiaTime);
  console.log('  Europa Central:', europeTime);
  
  // 5. Verificar si hay problemas de cambio de día
  const colombiaDay = new Date().getDate();
  const europeDay = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }).split('-')[2];
  
  console.log('📅 [TIMEZONE] Días:');
  console.log('  Colombia:', colombiaDay);
  console.log('  Europa Central:', europeDay);
  
  const isSameDay = colombiaDay.toString() === europeDay;
  console.log('✅ [TIMEZONE] Mismo día:', isSameDay);
  
  if (!isSameDay) {
    console.log('⚠️ [TIMEZONE] PROBLEMA: Diferentes días entre Colombia y Europa Central');
    console.log('   Esto puede causar problemas de persistencia de datos');
  }
  
  // 6. Verificar timezone offset
  const colombiaOffset = new Date().getTimezoneOffset();
  const europeOffset = new Date().toLocaleString('en-US', { 
    timeZone: 'Europe/Berlin',
    timeZoneName: 'longOffset'
  });
  
  console.log('🕐 [TIMEZONE] Offsets:');
  console.log('  Navegador (Colombia):', colombiaOffset, 'minutos');
  console.log('  Europa Central:', europeOffset);
  
  // 7. Simular problema de guardado/carga
  console.log('\n🔍 [TIMEZONE] Simulando flujo de guardado/carga:');
  
  // Simular guardado con Europa Central
  const saveDate = getCalculatorDate();
  console.log('💾 [TIMEZONE] Fecha de guardado (Europa Central):', saveDate);
  
  // Simular carga con Europa Central
  const loadDate = getCalculatorDate();
  console.log('📥 [TIMEZONE] Fecha de carga (Europa Central):', loadDate);
  
  const datesMatch = saveDate === loadDate;
  console.log('✅ [TIMEZONE] Fechas coinciden:', datesMatch);
  
  if (!datesMatch) {
    console.log('❌ [TIMEZONE] PROBLEMA: Fechas no coinciden entre guardado y carga');
  }
  
  return {
    browserTimezone,
    utcDate,
    colombiaDate,
    europeDate,
    calculatorDate,
    isSameDay,
    datesMatch,
    colombiaOffset,
    europeOffset
  };
}

// Ejecutar análisis
const result = testTimezoneFrontend();
console.log('\n✅ [TIMEZONE] Análisis completado:', result);
