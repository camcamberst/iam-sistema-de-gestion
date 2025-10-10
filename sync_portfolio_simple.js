// Script simple para sincronizar Portafolio de modelos existentes
async function syncExistingPortfolio() {
  try {
    console.log('🔄 Iniciando sincronización de Portafolio...');
    
    const response = await fetch('http://localhost:3000/api/sync-existing-portfolio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Sincronización exitosa:', result.message);
      if (result.results) {
        console.log('📋 Resultados detallados:');
        result.results.forEach(r => {
          if (r.success) {
            console.log(`  ✅ ${r.email}: ${r.platforms} plataformas`);
          } else {
            console.log(`  ❌ ${r.email}: ${r.error}`);
          }
        });
      }
    } else {
      console.error('❌ Error en sincronización:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.log('💡 Asegúrate de que el servidor esté ejecutándose en http://localhost:3000');
  }
}

syncExistingPortfolio();
