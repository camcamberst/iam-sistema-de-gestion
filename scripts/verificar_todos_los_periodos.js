/**
 * 🔍 SCRIPT: Verificar Todos los Períodos de Diciembre
 * 
 * Verifica valores residuales en todos los períodos de diciembre 2025
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarTodosLosPeriodos() {
  console.log('\n🔍 VERIFICACIÓN DE TODOS LOS PERÍODOS DE DICIEMBRE 2025');
  console.log('='.repeat(60));

  // Verificar período 1-15
  console.log('\n📅 PERÍODO 1-15 (2025-12-01 a 2025-12-15):');
  const { data: p1, error: e1 } = await supabase
    .from('model_values')
    .select('model_id')
    .gte('period_date', '2025-12-01')
    .lte('period_date', '2025-12-15');

  const p1PorModelo = new Map();
  if (p1) {
    p1.forEach(item => {
      const count = p1PorModelo.get(item.model_id) || 0;
      p1PorModelo.set(item.model_id, count + 1);
    });
  }

  console.log(`   Valores residuales: ${p1?.length || 0}`);
  console.log(`   Modelos afectados: ${p1PorModelo.size}`);

  // Verificar período 16-31
  console.log('\n📅 PERÍODO 16-31 (2025-12-16 a 2025-12-31):');
  const { data: p2, error: e2 } = await supabase
    .from('model_values')
    .select('model_id')
    .gte('period_date', '2025-12-16')
    .lte('period_date', '2025-12-31');

  const p2PorModelo = new Map();
  if (p2) {
    p2.forEach(item => {
      const count = p2PorModelo.get(item.model_id) || 0;
      p2PorModelo.set(item.model_id, count + 1);
    });
  }

  console.log(`   Valores residuales: ${p2?.length || 0}`);
  console.log(`   Modelos afectados: ${p2PorModelo.size}`);

  // Verificar todo diciembre
  console.log('\n📅 TODO DICIEMBRE (2025-12-01 a 2025-12-31):');
  const { data: todo, error: e3 } = await supabase
    .from('model_values')
    .select('model_id, period_date')
    .gte('period_date', '2025-12-01')
    .lte('period_date', '2025-12-31');

  const todoPorModelo = new Map();
  if (todo) {
    todo.forEach(item => {
      const count = todoPorModelo.get(item.model_id) || 0;
      todoPorModelo.set(item.model_id, count + 1);
    });
  }

  console.log(`   Total valores residuales: ${todo?.length || 0}`);
  console.log(`   Total modelos afectados: ${todoPorModelo.size}`);

  if (todo && todo.length > 0) {
    // Obtener emails
    const modelIds = Array.from(todoPorModelo.keys());
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', modelIds);

    const emailMap = new Map();
    if (users) {
      users.forEach(u => emailMap.set(u.id, u.email));
    }

    console.log('\n📋 MODELOS CON VALORES RESIDUALES:\n');
    for (const [modelId, count] of todoPorModelo.entries()) {
      const email = emailMap.get(modelId) || modelId;
      console.log(`   📧 ${email}: ${count} valores residuales`);
    }

    // Verificar archivo
    console.log('\n📋 Verificando archivo en calculator_history...\n');
    
    const { data: archivosP1 } = await supabase
      .from('calculator_history')
      .select('model_id')
      .eq('period_date', '2025-12-01')
      .eq('period_type', '1-15')
      .in('model_id', modelIds);

    const { data: archivosP2 } = await supabase
      .from('calculator_history')
      .select('model_id')
      .eq('period_date', '2025-12-16')
      .eq('period_type', '16-31')
      .in('model_id', modelIds);

    const archivosP1Set = new Set(archivosP1?.map(a => a.model_id) || []);
    const archivosP2Set = new Set(archivosP2?.map(a => a.model_id) || []);

    console.log(`📊 ARCHIVO:`);
    console.log(`   Período 1-15: ${archivosP1Set.size} modelos archivados`);
    console.log(`   Período 16-31: ${archivosP2Set.size} modelos archivados`);

    // Clasificar modelos
    const conArchivo = [];
    const sinArchivo = [];

    for (const modelId of modelIds) {
      const email = emailMap.get(modelId) || modelId;
      const residualCount = todoPorModelo.get(modelId) || 0;
      const tieneArchivoP1 = archivosP1Set.has(modelId);
      const tieneArchivoP2 = archivosP2Set.has(modelId);

      if (tieneArchivoP1 || tieneArchivoP2) {
        conArchivo.push({ email, residualCount, tieneArchivoP1, tieneArchivoP2 });
      } else {
        sinArchivo.push({ email, residualCount });
      }
    }

    if (conArchivo.length > 0) {
      console.log('\n✅ MODELOS CON ARCHIVO (pueden eliminar residuales):');
      conArchivo.forEach(m => {
        const archivos = [];
        if (m.tieneArchivoP1) archivos.push('P1');
        if (m.tieneArchivoP2) archivos.push('P2');
        console.log(`   ✅ ${m.email}: ${m.residualCount} residuales, archivo: ${archivos.join(', ')}`);
      });
    }

    if (sinArchivo.length > 0) {
      console.log('\n❌ MODELOS SIN ARCHIVO (requieren archivado primero):');
      sinArchivo.forEach(m => {
        console.log(`   ❌ ${m.email}: ${m.residualCount} residuales, NO archivados`);
      });
    }
  } else {
    console.log('\n✅ No hay valores residuales en diciembre 2025');
    console.log('   Los valores ya fueron eliminados correctamente');
  }

  // Exportar
  const fs = require('fs');
  const reporte = {
    fecha_verificacion: new Date().toISOString(),
    periodo_1_15: {
      valores_residuales: p1?.length || 0,
      modelos_afectados: p1PorModelo.size
    },
    periodo_16_31: {
      valores_residuales: p2?.length || 0,
      modelos_afectados: p2PorModelo.size
    },
    total_diciembre: {
      valores_residuales: todo?.length || 0,
      modelos_afectados: todoPorModelo.size
    }
  };

  fs.writeFileSync('reporte_todos_periodos_diciembre.json', JSON.stringify(reporte, null, 2));
  console.log('\n💾 Reporte guardado en: reporte_todos_periodos_diciembre.json');
}

verificarTodosLosPeriodos()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });







