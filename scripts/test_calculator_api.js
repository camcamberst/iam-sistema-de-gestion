/**
 * Script para probar qué devuelve el API de model-values-v2
 * para entender por qué Mi Calculadora sigue mostrando valores
 */

require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch').default || require('node-fetch');

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://iam-sistema-de-gestion.vercel.app';

async function testCalculatorAPI() {
  try {
    console.log('🔍 [TEST] Probando API de model-values-v2...');
    
    // Obtener una modelo de prueba (usando el ID de HollyRogers que mencionaste antes)
    const testModelId = '0976437e-15e6-424d-8122-afb65580239a'; // HollyRogers
    const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    
    console.log(`📅 [TEST] Fecha actual Colombia: ${todayDate}`);
    console.log(`👤 [TEST] Modelo de prueba: ${testModelId}`);
    
    // Probar con la fecha actual
    const url = `${API_URL}/api/calculator/model-values-v2?modelId=${testModelId}&periodDate=${todayDate}`;
    console.log(`🌐 [TEST] URL: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('\n📦 [TEST] Respuesta del API:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.data && data.data.length > 0) {
      console.log(`\n⚠️ [TEST] El API devolvió ${data.data.length} valores para la fecha ${todayDate}`);
      console.log('   Valores encontrados:');
      data.data.forEach(v => {
        console.log(`     - Plataforma: ${v.platform_id}, Valor: ${v.value}, Fecha: ${v.period_date}`);
      });
    } else {
      console.log(`\n✅ [TEST] El API no devolvió valores para la fecha ${todayDate}`);
      console.log('   Esto es correcto - la calculadora debería estar vacía');
    }
    
    // También probar con fechas del período 1-15 de noviembre
    console.log('\n🔍 [TEST] Probando con fechas del período 1-15 de noviembre:');
    for (let day = 1; day <= 15; day++) {
      const testDate = `2025-11-${String(day).padStart(2, '0')}`;
      const testUrl = `${API_URL}/api/calculator/model-values-v2?modelId=${testModelId}&periodDate=${testDate}`;
      
      try {
        const testResponse = await fetch(testUrl);
        const testData = await testResponse.json();
        
        if (testData.success && testData.data && testData.data.length > 0) {
          console.log(`   ⚠️ ${testDate}: ${testData.data.length} valores encontrados`);
        }
      } catch (err) {
        // Ignorar errores individuales
      }
    }
    
  } catch (error) {
    console.error('❌ [TEST] Error:', error);
  }
}

testCalculatorAPI();



