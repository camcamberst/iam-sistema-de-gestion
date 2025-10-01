// Script para probar la API model-values-v2 directamente
const testApi = async () => {
  const modelId = 'fe54995d-1828-4721-8153-53fce6f4fe56';
  const periodDate = '2025-10-01';
  
  console.log('🔍 [DEBUG] Probando API model-values-v2...');
  console.log('🔍 [DEBUG] ModelId:', modelId);
  console.log('🔍 [DEBUG] PeriodDate:', periodDate);
  
  try {
    const response = await fetch(`https://iam-sistema-de-gestion.vercel.app/api/calculator/model-values-v2?modelId=${modelId}&periodDate=${periodDate}`);
    console.log('🔍 [DEBUG] Response status:', response.status);
    console.log('🔍 [DEBUG] Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('🔍 [DEBUG] Response data:', data);
    
    if (data.success) {
      console.log('✅ [DEBUG] API funciona correctamente');
      console.log('✅ [DEBUG] Datos encontrados:', data.data?.length || 0);
    } else {
      console.log('❌ [DEBUG] API falló:', data.error);
    }
  } catch (error) {
    console.log('❌ [DEBUG] Error de red:', error.message);
  }
};

// Ejecutar en el navegador
testApi();
