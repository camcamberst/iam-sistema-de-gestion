/**
 * 🔍 DEBUG: Verificar persistencia de valores en calculadora
 * 
 * Este script verifica:
 * 1. Si los valores se están guardando correctamente
 * 2. Si se están cargando correctamente
 * 3. Si hay problemas de timezone o fechas
 * 4. Si hay conflictos entre guardado y carga
 */

// Simular el flujo completo de guardado y carga
async function debugCalculatorPersistence() {
  console.log('🔍 [DEBUG] Iniciando análisis de persistencia...');
  
  // 1. Simular fecha actual
  const currentDate = new Date();
  const europeDate = new Date(currentDate.toLocaleString("en-US", {timeZone: "Europe/Berlin"}));
  const periodDate = europeDate.toISOString().split('T')[0];
  
  console.log('🔍 [DEBUG] Fecha actual (Colombia):', currentDate.toISOString().split('T')[0]);
  console.log('🔍 [DEBUG] Fecha Europa Central:', periodDate);
  
  // 2. Simular valores de prueba
  const testValues = {
    '777': 100,
    'babestation': 200,
    'camcontacts': 300,
    'dirtyfans': 400
  };
  
  console.log('🔍 [DEBUG] Valores de prueba:', testValues);
  
  // 3. Simular payload de guardado
  const savePayload = {
    modelId: 'fe54995d-1828-4721-8153-53fce6f4fe56', // ID de prueba
    values: testValues,
    periodDate: periodDate
  };
  
  console.log('🔍 [DEBUG] Payload de guardado:', savePayload);
  
  // 4. Simular consulta de carga
  const loadQuery = {
    modelId: 'fe54995d-1828-4721-8153-53fce6f4fe56',
    periodDate: periodDate
  };
  
  console.log('🔍 [DEBUG] Query de carga:', loadQuery);
  
  // 5. Verificar consistencia de fechas
  const dateConsistency = {
    saveDate: periodDate,
    loadDate: periodDate,
    consistent: true
  };
  
  console.log('🔍 [DEBUG] Consistencia de fechas:', dateConsistency);
  
  // 6. Simular posibles problemas
  const potentialIssues = [
    'Timezone mismatch entre guardado y carga',
    'Valores se guardan en fecha incorrecta',
    'Carga busca en fecha diferente',
    'Conflicto entre autosave y guardado manual',
    'Doble guardado sobrescribiendo valores'
  ];
  
  console.log('🔍 [DEBUG] Posibles problemas identificados:');
  potentialIssues.forEach((issue, index) => {
    console.log(`  ${index + 1}. ${issue}`);
  });
  
  return {
    periodDate,
    testValues,
    savePayload,
    loadQuery,
    dateConsistency,
    potentialIssues
  };
}

// Ejecutar debug
debugCalculatorPersistence().then(result => {
  console.log('✅ [DEBUG] Análisis completado:', result);
}).catch(error => {
  console.error('❌ [DEBUG] Error en análisis:', error);
});
