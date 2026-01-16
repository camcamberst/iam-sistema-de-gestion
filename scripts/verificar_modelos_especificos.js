/**
 * 🔍 SCRIPT: Verificar Modelos Específicos con Valores Residuales
 * 
 * Verifica el estado de archivado para modelos específicos que tienen valores residuales
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Modelos con valores residuales detectados
const modelosConResiduales = [
  "668e5799-1a78-4980-a33b-52674328bb33",
  "379957fd-560c-4986-ab3a-45c3d2738e55",
  "b305dcac-760d-4512-bd11-e493063a8d97",
  "9eebc3dd-a8b4-4657-9b36-60159c075d0d",
  "4e6271f6-d33f-4998-bfc3-631506a84d15",
  "0976437e-15e6-424d-8122-afb65580239a",
  "474a6854-5cc2-421b-9982-054739d2f037",
  "0df5b39d-eed4-4c10-9fef-adfa59908f64",
  "c7399ba3-d398-4961-8f93-96c1381c53ad",
  "e26abcde-45c7-469c-acfe-2856acc3a8f8",
  "b9dfa52a-5d60-4aec-8681-a5c63a1f7867",
  "4b387b66-d3e3-4ac6-86d3-bf850d3146ed",
  "f33780a5-9039-42dc-b4f4-269b200f5b56",
  "64b3ac29-8a20-4cdb-871c-433d200ba99a",
  "67b2a748-0926-4428-b580-346bec06ffe3",
  "4c4d4143-89ba-4cec-97a6-ef12b4904a50",
  "dac0bc99-85a5-4806-9bc1-76a7ae4ef315",
  "741a75e8-2591-4e31-a4d9-8438f6011fbb",
  "6a055b9e-85b3-4589-9f0a-8203dc66d592",
  "f99a64ab-bdb0-4963-94ef-1f7366dd02c4",
  "437b4e71-5628-41c0-b3d8-08e86dfe0cad",
  "aa469621-584e-4a4a-a339-0803eff2fd7d",
  "9609fdda-df95-4170-ba02-16dd12ac7197",
  "f92ae8a1-ce23-4888-8171-ea5037c7d02b",
  "44736a3f-bbf4-43b4-9ad6-507cf05c3ad3"
];

async function verificarModelosEspecificos() {
  console.log('\n🔍 VERIFICACIÓN DE MODELOS ESPECÍFICOS CON VALORES RESIDUALES');
  console.log('='.repeat(60));
  console.log(`📅 Período: 16-31 (2025-12-16)`);
  console.log(`📊 Total modelos a verificar: ${modelosConResiduales.length}`);
  console.log('='.repeat(60));

  const periodDate = '2025-12-16';
  const periodType = '16-31';
  const startDate = '2025-12-16';
  const endDate = '2025-12-31';

  // Obtener emails de los modelos
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email')
    .in('id', modelosConResiduales);

  const emailMap = new Map();
  if (users) {
    users.forEach(u => emailMap.set(u.id, u.email));
  }

  const resultados = [];
  let modelosConArchivo = 0;
  let modelosSinArchivo = 0;

  console.log('\n📋 Verificando estado de archivado...\n');

  for (const modelId of modelosConResiduales) {
    const email = emailMap.get(modelId) || modelId;
    const resultado = {
      model_id: modelId,
      email,
      tiene_archivo: false,
      registros_archivados: 0,
      plataformas_archivadas: [],
      valores_residuales: 0,
      archivo_completo: false
    };

    // Verificar archivo en calculator_history
    const { data: history, error: historyError } = await supabase
      .from('calculator_history')
      .select('platform_id, value_usd_bruto, value_usd_modelo, value_cop_modelo')
      .eq('model_id', modelId)
      .eq('period_date', startDate)
      .eq('period_type', periodType);

    if (!historyError && history && history.length > 0) {
      resultado.tiene_archivo = true;
      resultado.registros_archivados = history.length;
      resultado.plataformas_archivadas = history.map(h => h.platform_id);
      modelosConArchivo++;

      // Verificar integridad
      const incompletos = history.filter(h => 
        h.value_usd_bruto === null || h.value_usd_modelo === null || h.value_cop_modelo === null
      );
      resultado.archivo_completo = incompletos.length === 0;
    } else {
      modelosSinArchivo++;
    }

    // Verificar valores residuales
    const { data: residual, error: residualError } = await supabase
      .from('model_values')
      .select('platform_id')
      .eq('model_id', modelId)
      .gte('period_date', startDate)
      .lte('period_date', endDate);

    if (!residualError && residual) {
      resultado.valores_residuales = residual.length;
    }

    resultados.push(resultado);
  }

  // Reporte
  console.log('📊 REPORTE DE VERIFICACIÓN');
  console.log('='.repeat(60));
  console.log(`✅ Modelos con archivo: ${modelosConArchivo}`);
  console.log(`❌ Modelos sin archivo: ${modelosSinArchivo}`);
  console.log(`📊 Total modelos verificados: ${resultados.length}`);

  // Modelos con archivo
  const conArchivo = resultados.filter(r => r.tiene_archivo);
  if (conArchivo.length > 0) {
    console.log('\n✅ MODELOS CON ARCHIVO (pueden eliminar residuales):');
    console.log('='.repeat(60));
    conArchivo.forEach(r => {
      console.log(`   ✅ ${r.email}: ${r.registros_archivados} registros archivados, ${r.valores_residuales} residuales`);
    });
  }

  // Modelos sin archivo
  const sinArchivo = resultados.filter(r => !r.tiene_archivo);
  if (sinArchivo.length > 0) {
    console.log('\n❌ MODELOS SIN ARCHIVO (requieren archivado primero):');
    console.log('='.repeat(60));
    sinArchivo.forEach(r => {
      console.log(`   ❌ ${r.email}: ${r.valores_residuales} valores residuales, NO archivados`);
    });
  }

  // Exportar
  const fs = require('fs');
  const reportePath = `reporte_modelos_especificos_${periodDate}_${periodType.replace('-', '_')}.json`;
  fs.writeFileSync(reportePath, JSON.stringify({
    periodo: { period_date: periodDate, period_type: periodType },
    fecha_verificacion: new Date().toISOString(),
    resumen: {
      total_modelos: resultados.length,
      modelos_con_archivo: modelosConArchivo,
      modelos_sin_archivo: modelosSinArchivo
    },
    resultados: resultados
  }, null, 2));
  console.log(`\n💾 Reporte guardado en: ${reportePath}`);

  return resultados;
}

verificarModelosEspecificos()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });







