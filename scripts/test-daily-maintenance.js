// Script para probar el mantenimiento diario de ganancias
const fetch = require('node-fetch');

async function testDailyMaintenance() {
  try {
    console.log('🔄 [TEST] Probando mantenimiento diario de ganancias...');
    
    // 1. Obtener estadísticas antes del mantenimiento
    console.log('\n📊 [TEST] Estadísticas ANTES del mantenimiento:');
    const beforeResponse = await fetch('http://localhost:3000/api/admin/daily-earnings-maintenance');
    const beforeData = await beforeResponse.json();
    console.log(JSON.stringify(beforeData, null, 2));
    
    // 2. Ejecutar mantenimiento
    console.log('\n🔄 [TEST] Ejecutando mantenimiento...');
    const maintenanceResponse = await fetch('http://localhost:3000/api/admin/daily-earnings-maintenance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const maintenanceData = await maintenanceResponse.json();
    console.log(JSON.stringify(maintenanceData, null, 2));
    
    // 3. Obtener estadísticas después del mantenimiento
    console.log('\n📊 [TEST] Estadísticas DESPUÉS del mantenimiento:');
    const afterResponse = await fetch('http://localhost:3000/api/admin/daily-earnings-maintenance');
    const afterData = await afterResponse.json();
    console.log(JSON.stringify(afterData, null, 2));
    
    // 4. Probar consulta de historial
    console.log('\n📚 [TEST] Consultando historial de ganancias:');
    const historyResponse = await fetch('http://localhost:3000/api/daily-earnings/history?limit=10');
    const historyData = await historyResponse.json();
    console.log(JSON.stringify(historyData, null, 2));
    
    console.log('\n✅ [TEST] Prueba completada exitosamente!');
    
  } catch (error) {
    console.error('❌ [TEST] Error:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testDailyMaintenance();
}

module.exports = { testDailyMaintenance };
