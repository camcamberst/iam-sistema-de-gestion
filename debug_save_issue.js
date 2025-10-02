// 🔍 SCRIPT DE DEBUG MEJORADO PARA VERIFICAR EL PROBLEMA DE GUARDADO
// Ejecutar en la consola del navegador en "Ver Calculadora de Modelo"

console.log('🔍 [DEBUG] Iniciando diagnóstico sistemático del problema de guardado...');

// Obtener información del contexto actual
function getCurrentContext() {
  console.log('🔍 [DEBUG] === CONTEXTO ACTUAL ===');
  console.log('🔍 [DEBUG] URL actual:', window.location.href);
  console.log('🔍 [DEBUG] User agent:', navigator.userAgent);
  console.log('🔍 [DEBUG] Timestamp:', new Date().toISOString());
  
  // Intentar obtener modelId del contexto
  const urlParams = new URLSearchParams(window.location.search);
  const modelId = urlParams.get('modelId');
  console.log('🔍 [DEBUG] ModelId from URL:', modelId);
  
  return modelId;
}

// 1. Verificar datos actuales con fecha actual
async function checkCurrentData(modelId) {
  console.log('🔍 [DEBUG] 1. Verificando datos actuales...');
  
  const today = new Date().toISOString().split('T')[0];
  console.log('🔍 [DEBUG] Fecha actual:', today);
  
  const response = await fetch(`/api/calculator/model-values-v2?modelId=${modelId}&periodDate=${today}`);
  const data = await response.json();
  
  console.log('🔍 [DEBUG] Datos actuales:', data);
  console.log('🔍 [DEBUG] Status:', response.status);
  console.log('🔍 [DEBUG] Headers:', Object.fromEntries(response.headers.entries()));
  
  return data;
}

// 2. Intentar guardar datos de prueba
async function testSave(modelId) {
  console.log('🔍 [DEBUG] 2. Probando guardado...');
  
  const today = new Date().toISOString().split('T')[0];
  const testValues = {
    '777': 10.50,
    'big7': 25.00,
    'aw': 15.75
  };
  
  const payload = {
    modelId: modelId,
    values: testValues,
    periodDate: today
  };
  
  console.log('🔍 [DEBUG] Payload a enviar:', payload);
  
  const response = await fetch('/api/calculator/model-values-v2', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  console.log('🔍 [DEBUG] Response status:', response.status);
  console.log('🔍 [DEBUG] Response headers:', Object.fromEntries(response.headers.entries()));
  
  const data = await response.json();
  console.log('🔍 [DEBUG] Respuesta del guardado:', data);
  
  return { response, data };
}

// 3. Verificar si se guardó
async function verifySave(modelId) {
  console.log('🔍 [DEBUG] 3. Verificando si se guardó...');
  
  const today = new Date().toISOString().split('T')[0];
  const response = await fetch(`/api/calculator/model-values-v2?modelId=${modelId}&periodDate=${today}`);
  const data = await response.json();
  
  console.log('🔍 [DEBUG] Datos después del guardado:', data);
  console.log('🔍 [DEBUG] Status:', response.status);
  
  return data;
}

// 4. Probar con diferentes fechas
async function testWithDifferentDates(modelId) {
  console.log('🔍 [DEBUG] 4. Probando con diferentes fechas...');
  
  const dates = [
    new Date().toISOString().split('T')[0], // Hoy
    '2025-01-20', // Fecha específica
    '2025-01-21'  // Otra fecha
  ];
  
  for (const date of dates) {
    console.log(`🔍 [DEBUG] Probando con fecha: ${date}`);
    const response = await fetch(`/api/calculator/model-values-v2?modelId=${modelId}&periodDate=${date}`);
    const data = await response.json();
    console.log(`🔍 [DEBUG] Resultado para ${date}:`, data);
  }
}

// Ejecutar diagnóstico completo
async function runDiagnosis() {
  try {
    console.log('🔍 [DEBUG] === DIAGNÓSTICO SISTEMÁTICO INICIADO ===');
    
    const modelId = getCurrentContext();
    
    if (!modelId) {
      console.error('❌ [DEBUG] No se pudo obtener modelId del contexto');
      console.log('🔍 [DEBUG] Intenta ejecutar: runDiagnosis("TU_MODEL_ID_AQUI")');
      return;
    }
    
    console.log('🔍 [DEBUG] Usando modelId:', modelId);
    
    const before = await checkCurrentData(modelId);
    console.log('📊 [DEBUG] Estado inicial:', before);
    
    const saveResult = await testSave(modelId);
    console.log('💾 [DEBUG] Resultado del guardado:', saveResult);
    
    if (saveResult.data.success) {
      const after = await verifySave(modelId);
      console.log('📊 [DEBUG] Estado final:', after);
      
      // Comparar antes y después
      console.log('🔍 [DEBUG] === COMPARACIÓN ===');
      console.log('🔍 [DEBUG] Antes:', before);
      console.log('🔍 [DEBUG] Después:', after);
    } else {
      console.error('❌ [DEBUG] El guardado falló:', saveResult.data);
    }
    
    // Probar con diferentes fechas
    await testWithDifferentDates(modelId);
    
    console.log('🔍 [DEBUG] === FIN DEL DIAGNÓSTICO ===');
    
  } catch (error) {
    console.error('❌ [DEBUG] Error en diagnóstico:', error);
    console.error('❌ [DEBUG] Stack trace:', error.stack);
  }
}

// Función para ejecutar con modelId específico
async function runDiagnosisWithModelId(modelId) {
  console.log('🔍 [DEBUG] Ejecutando diagnóstico con modelId:', modelId);
  
  try {
    const before = await checkCurrentData(modelId);
    console.log('📊 [DEBUG] Estado inicial:', before);
    
    const saveResult = await testSave(modelId);
    console.log('💾 [DEBUG] Resultado del guardado:', saveResult);
    
    if (saveResult.data.success) {
      const after = await verifySave(modelId);
      console.log('📊 [DEBUG] Estado final:', after);
    }
    
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
  }
}

// Ejecutar automáticamente
runDiagnosis();

console.log('🔍 [DEBUG] Script cargado. Usa runDiagnosisWithModelId("TU_MODEL_ID") para probar con un ID específico.');
