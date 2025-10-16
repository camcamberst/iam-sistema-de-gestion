const fetch = require('node-fetch').default;

async function callCleanupEndpoint() {
  try {
    console.log('🔍 [CLEANUP-ENDPOINT] Llamando al endpoint de limpieza...');
    
    const response = await fetch('http://localhost:3000/api/admin/clean-history-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [CLEANUP-ENDPOINT] Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ [CLEANUP-ENDPOINT] Respuesta del endpoint:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n🎉 [CLEANUP-ENDPOINT] Limpieza exitosa!');
      console.log(`📊 Período 2 eliminado: ${result.results.period2_deleted} registros`);
      console.log(`📊 Duplicados eliminados: ${result.results.duplicates_deleted} registros`);
      console.log(`📊 Período 2 restantes: ${result.results.period2_remaining} registros`);
    } else {
      console.log('❌ [CLEANUP-ENDPOINT] Error en la limpieza:', result.error);
    }
    
  } catch (error) {
    console.error('❌ [CLEANUP-ENDPOINT] Error:', error);
  }
}

callCleanupEndpoint();
