/**
 * 🔍 SCRIPT: Verificar Valores Residuales Directamente
 * 
 * Verifica directamente en model_values si hay valores residuales
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarValoresResiduales() {
  console.log('\n🔍 VERIFICACIÓN DIRECTA DE VALORES RESIDUALES');
  console.log('='.repeat(60));
  console.log('📅 Período: 16-31 de Diciembre 2025');
  console.log('📅 Rango: 2025-12-16 a 2025-12-31');
  console.log('='.repeat(60));

  const startDate = '2025-12-16';
  const endDate = '2025-12-31';

  // Verificar valores residuales
  console.log('\n📋 Verificando valores residuales en model_values...\n');
  
  const { data: residuales, error: residualError } = await supabase
    .from('model_values')
    .select('model_id, platform_id, value, period_date')
    .gte('period_date', startDate)
    .lte('period_date', endDate);

  if (residualError) {
    console.error('❌ Error:', residualError);
    return;
  }

  if (!residuales || residuales.length === 0) {
    console.log('✅ No hay valores residuales en el rango especificado');
    console.log('   Esto significa que los valores ya fueron eliminados o no existen');
    return;
  }

  // Agrupar por modelo
  const porModelo = new Map();
  residuales.forEach(item => {
    const count = porModelo.get(item.model_id) || 0;
    porModelo.set(item.model_id, count + 1);
  });

  console.log(`📊 RESULTADOS:`);
  console.log(`   Total valores residuales: ${residuales.length}`);
  console.log(`   Modelos afectados: ${porModelo.size}`);
  console.log('\n📋 Desglose por modelo:\n');

  // Obtener emails
  const modelIds = Array.from(porModelo.keys());
  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .in('id', modelIds);

  const emailMap = new Map();
  if (users) {
    users.forEach(u => emailMap.set(u.id, u.email));
  }

  // Mostrar resultados
  for (const [modelId, count] of porModelo.entries()) {
    const email = emailMap.get(modelId) || modelId;
    console.log(`   📧 ${email}: ${count} valores residuales`);
  }

  // Verificar archivo
  console.log('\n📋 Verificando archivo en calculator_history...\n');
  
  const { data: archivos, error: archivoError } = await supabase
    .from('calculator_history')
    .select('model_id, platform_id')
    .eq('period_date', startDate)
    .eq('period_type', '16-31')
    .in('model_id', modelIds);

  if (!archivoError && archivos) {
    const archivosPorModelo = new Map();
    archivos.forEach(item => {
      const count = archivosPorModelo.get(item.model_id) || 0;
      archivosPorModelo.set(item.model_id, count + 1);
    });

    console.log(`📊 ARCHIVO:`);
    console.log(`   Modelos con archivo: ${archivosPorModelo.size}`);
    console.log(`   Modelos sin archivo: ${modelIds.length - archivosPorModelo.size}`);

    // Modelos con archivo
    const conArchivo = [];
    const sinArchivo = [];

    for (const modelId of modelIds) {
      const email = emailMap.get(modelId) || modelId;
      const residualCount = porModelo.get(modelId) || 0;
      const archivoCount = archivosPorModelo.get(modelId) || 0;

      if (archivoCount > 0) {
        conArchivo.push({ email, residualCount, archivoCount });
      } else {
        sinArchivo.push({ email, residualCount });
      }
    }

    if (conArchivo.length > 0) {
      console.log('\n✅ MODELOS CON ARCHIVO (pueden eliminar residuales):');
      conArchivo.forEach(m => {
        console.log(`   ✅ ${m.email}: ${m.residualCount} residuales, ${m.archivoCount} registros archivados`);
      });
    }

    if (sinArchivo.length > 0) {
      console.log('\n❌ MODELOS SIN ARCHIVO (requieren archivado primero):');
      sinArchivo.forEach(m => {
        console.log(`   ❌ ${m.email}: ${m.residualCount} residuales, NO archivados`);
      });
    }
  }

  // Exportar
  const fs = require('fs');
  const reporte = {
    fecha_verificacion: new Date().toISOString(),
    rango: { startDate, endDate },
    total_residuales: residuales.length,
    modelos_afectados: porModelo.size,
    modelos: Array.from(porModelo.entries()).map(([id, count]) => ({
      model_id: id,
      email: emailMap.get(id) || id,
      valores_residuales: count
    }))
  };

  fs.writeFileSync('reporte_valores_residuales_directo.json', JSON.stringify(reporte, null, 2));
  console.log('\n💾 Reporte guardado en: reporte_valores_residuales_directo.json');
}

verificarValoresResiduales()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });







