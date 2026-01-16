/**
 * 🔍 SCRIPT: Verificar Archivo Completo en calculator_history
 * 
 * Verifica que los datos están archivados correctamente en calculator_history
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarArchivoCompleto() {
  console.log('\n🔍 VERIFICACIÓN DE ARCHIVO COMPLETO EN calculator_history');
  console.log('='.repeat(60));

  // Verificar período 1-15
  console.log('\n📅 PERÍODO 1-15 (2025-12-01):');
  const { data: p1, error: e1 } = await supabase
    .from('calculator_history')
    .select('model_id, platform_id, value, value_usd_bruto, value_usd_modelo, value_cop_modelo')
    .eq('period_date', '2025-12-01')
    .eq('period_type', '1-15');

  if (e1) {
    console.error('❌ Error:', e1);
  } else {
    const p1PorModelo = new Map();
    if (p1) {
      p1.forEach(item => {
        const count = p1PorModelo.get(item.model_id) || 0;
        p1PorModelo.set(item.model_id, count + 1);
      });
    }

    console.log(`   Registros archivados: ${p1?.length || 0}`);
    console.log(`   Modelos con archivo: ${p1PorModelo.size}`);
    
    if (p1 && p1.length > 0) {
      // Verificar integridad
      const incompletos = p1.filter(h => 
        h.value_usd_bruto === null || h.value_usd_modelo === null || h.value_cop_modelo === null
      );
      console.log(`   Registros incompletos: ${incompletos.length}`);
      
      // Verificar detalle por plataforma
      const plataformas = new Set(p1.map(h => h.platform_id));
      console.log(`   Plataformas diferentes: ${plataformas.size}`);
    }
  }

  // Verificar período 16-31
  console.log('\n📅 PERÍODO 16-31 (2025-12-16):');
  const { data: p2, error: e2 } = await supabase
    .from('calculator_history')
    .select('model_id, platform_id, value, value_usd_bruto, value_usd_modelo, value_cop_modelo')
    .eq('period_date', '2025-12-16')
    .eq('period_type', '16-31');

  if (e2) {
    console.error('❌ Error:', e2);
  } else {
    const p2PorModelo = new Map();
    if (p2) {
      p2.forEach(item => {
        const count = p2PorModelo.get(item.model_id) || 0;
        p2PorModelo.set(item.model_id, count + 1);
      });
    }

    console.log(`   Registros archivados: ${p2?.length || 0}`);
    console.log(`   Modelos con archivo: ${p2PorModelo.size}`);
    
    if (p2 && p2.length > 0) {
      // Verificar integridad
      const incompletos = p2.filter(h => 
        h.value_usd_bruto === null || h.value_usd_modelo === null || h.value_cop_modelo === null
      );
      console.log(`   Registros incompletos: ${incompletos.length}`);
      
      // Verificar detalle por plataforma
      const plataformas = new Set(p2.map(h => h.platform_id));
      console.log(`   Plataformas diferentes: ${plataformas.size}`);
      
      // Mostrar ejemplo de un modelo
      if (p2.length > 0) {
        const primerModelo = p2[0].model_id;
        const registrosModelo = p2.filter(h => h.model_id === primerModelo);
        console.log(`\n   📊 Ejemplo - Modelo ${primerModelo}:`);
        console.log(`      Registros: ${registrosModelo.length}`);
        console.log(`      Plataformas: ${registrosModelo.map(r => r.platform_id).join(', ')}`);
      }
    } else {
      console.log('   ⚠️ No hay registros archivados para este período');
    }
  }

  // Resumen
  console.log('\n📊 RESUMEN:');
  console.log('='.repeat(60));
  console.log(`✅ Período 1-15: ${p1?.length || 0} registros archivados`);
  console.log(`✅ Período 16-31: ${p2?.length || 0} registros archivados`);
  
  if ((p1?.length || 0) === 0 && (p2?.length || 0) === 0) {
    console.log('\n⚠️ ADVERTENCIA: No hay registros archivados para diciembre 2025');
    console.log('   Esto puede indicar que el cierre de período no se ejecutó correctamente');
  } else {
    console.log('\n✅ Los datos están archivados en calculator_history');
  }

  // Exportar
  const fs = require('fs');
  const reporte = {
    fecha_verificacion: new Date().toISOString(),
    periodo_1_15: {
      registros: p1?.length || 0,
      modelos: p1 ? new Set(p1.map(h => h.model_id)).size : 0,
      plataformas: p1 ? new Set(p1.map(h => h.platform_id)).size : 0
    },
    periodo_16_31: {
      registros: p2?.length || 0,
      modelos: p2 ? new Set(p2.map(h => h.model_id)).size : 0,
      plataformas: p2 ? new Set(p2.map(h => h.platform_id)).size : 0
    }
  };

  fs.writeFileSync('reporte_archivo_completo.json', JSON.stringify(reporte, null, 2));
  console.log('\n💾 Reporte guardado en: reporte_archivo_completo.json');
}

verificarArchivoCompleto()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });







