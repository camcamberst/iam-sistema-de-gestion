/**
 * 🔍 SCRIPT DE VERIFICACIÓN: Archivado de Cierre de Período
 * 
 * Este script verifica que los valores por plataforma se hayan archivado
 * correctamente en calculator_history ANTES de que se eliminen de model_values
 * 
 * Uso: node scripts/verificar_archivado_cierre_periodo.js [period_date] [period_type]
 * Ejemplo: node scripts/verificar_archivado_cierre_periodo.js 2025-12-16 16-31
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarArchivado(periodDate, periodType) {
  console.log('\n🔍 VERIFICACIÓN DE ARCHIVADO DE CIERRE DE PERÍODO');
  console.log('='.repeat(60));
  console.log(`📅 Período: ${periodType} (${periodDate})`);
  console.log('='.repeat(60));

  try {
    // 1. Obtener todos los modelos activos
    console.log('\n📋 Paso 1: Obteniendo modelos activos...');
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('role', 'modelo')
      .eq('is_active', true);

    if (modelsError) {
      console.error('❌ Error obteniendo modelos:', modelsError);
      return;
    }

    console.log(`✅ Encontrados ${models.length} modelos activos`);

    // 2. Para cada modelo, verificar:
    //    a) Si hay registros en calculator_history para el período
    //    b) Si hay valores residuales en model_values para el período
    //    c) Si el archivo tiene detalle por plataforma

    const resultados = [];
    let modelosConArchivo = 0;
    let modelosSinArchivo = 0;
    let modelosConValoresResiduales = 0;
    let modelosConArchivoIncompleto = 0;

    for (const model of models) {
      const resultado = {
        model_id: model.id,
        email: model.email,
        tiene_archivo: false,
        registros_archivados: 0,
        plataformas_archivadas: [],
        tiene_valores_residuales: false,
        valores_residuales: 0,
        archivo_completo: false,
        problemas: []
      };

      // 2a. Verificar registros en calculator_history
      const { data: history, error: historyError } = await supabase
        .from('calculator_history')
        .select('platform_id, value, value_usd_bruto, value_usd_modelo, value_cop_modelo')
        .eq('model_id', model.id)
        .eq('period_date', periodDate)
        .eq('period_type', periodType);

      if (historyError) {
        resultado.problemas.push(`Error consultando calculator_history: ${historyError.message}`);
      } else if (history && history.length > 0) {
        resultado.tiene_archivo = true;
        resultado.registros_archivados = history.length;
        resultado.plataformas_archivadas = history.map(h => h.platform_id);
        modelosConArchivo++;

        // Verificar que cada registro tiene los campos calculados
        const registrosIncompletos = history.filter(h => 
          h.value_usd_bruto === null || h.value_usd_bruto === undefined ||
          h.value_usd_modelo === null || h.value_usd_modelo === undefined ||
          h.value_cop_modelo === null || h.value_cop_modelo === undefined
        );

        if (registrosIncompletos.length > 0) {
          resultado.problemas.push(`${registrosIncompletos.length} registros sin campos calculados completos`);
          modelosConArchivoIncompleto++;
        } else {
          resultado.archivo_completo = true;
        }
      } else {
        resultado.problemas.push('No hay registros archivados en calculator_history');
        modelosSinArchivo++;
      }

      // 2b. Verificar valores residuales en model_values
      // Calcular rango de fechas del período
      const [year, month] = periodDate.split('-').map(Number);
      let startDate, endDate;
      
      if (periodType === '1-15') {
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        endDate = `${year}-${String(month).padStart(2, '0')}-15`;
      } else {
        startDate = `${year}-${String(month).padStart(2, '0')}-16`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }

      const { data: residualValues, error: residualError } = await supabase
        .from('model_values')
        .select('platform_id, value')
        .eq('model_id', model.id)
        .gte('period_date', startDate)
        .lte('period_date', endDate);

      if (residualError) {
        resultado.problemas.push(`Error consultando model_values: ${residualError.message}`);
      } else if (residualValues && residualValues.length > 0) {
        resultado.tiene_valores_residuales = true;
        resultado.valores_residuales = residualValues.length;
        modelosConValoresResiduales++;
        resultado.problemas.push(`⚠️ CRÍTICO: ${residualValues.length} valores residuales en model_values (deberían estar archivados)`);
      }

      resultados.push(resultado);
    }

    // 3. Generar reporte
    console.log('\n📊 REPORTE DE VERIFICACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Modelos con archivo completo: ${modelosConArchivo}`);
    console.log(`❌ Modelos sin archivo: ${modelosSinArchivo}`);
    console.log(`⚠️ Modelos con valores residuales: ${modelosConValoresResiduales}`);
    console.log(`⚠️ Modelos con archivo incompleto: ${modelosConArchivoIncompleto}`);

    // 4. Mostrar modelos con problemas
    const modelosConProblemas = resultados.filter(r => r.problemas.length > 0);
    if (modelosConProblemas.length > 0) {
      console.log('\n⚠️ MODELOS CON PROBLEMAS:');
      console.log('='.repeat(60));
      modelosConProblemas.forEach(r => {
        console.log(`\n📧 ${r.email}`);
        console.log(`   ID: ${r.model_id}`);
        if (r.tiene_archivo) {
          console.log(`   ✅ Tiene archivo: ${r.registros_archivados} registros`);
          console.log(`   📊 Plataformas: ${r.plataformas_archivadas.join(', ')}`);
        } else {
          console.log(`   ❌ NO tiene archivo`);
        }
        if (r.tiene_valores_residuales) {
          console.log(`   ⚠️ CRÍTICO: ${r.valores_residuales} valores residuales en model_values`);
        }
        r.problemas.forEach(p => console.log(`   ⚠️ ${p}`));
      });
    }

    // 5. Mostrar modelos sin problemas
    const modelosSinProblemas = resultados.filter(r => 
      r.tiene_archivo && 
      r.archivo_completo && 
      !r.tiene_valores_residuales && 
      r.problemas.length === 0
    );
    
    if (modelosSinProblemas.length > 0) {
      console.log('\n✅ MODELOS SIN PROBLEMAS:');
      console.log('='.repeat(60));
      console.log(`Total: ${modelosSinProblemas.length} modelos`);
      modelosSinProblemas.slice(0, 10).forEach(r => {
        console.log(`   ✅ ${r.email}: ${r.registros_archivados} registros archivados`);
      });
      if (modelosSinProblemas.length > 10) {
        console.log(`   ... y ${modelosSinProblemas.length - 10} más`);
      }
    }

    // 6. Resumen final
    console.log('\n📋 RESUMEN FINAL');
    console.log('='.repeat(60));
    if (modelosSinArchivo > 0) {
      console.log(`❌ CRÍTICO: ${modelosSinArchivo} modelos NO tienen archivo en calculator_history`);
      console.log(`   Esto significa que los valores NO fueron archivados antes del cierre`);
    }
    if (modelosConValoresResiduales > 0) {
      console.log(`❌ CRÍTICO: ${modelosConValoresResiduales} modelos tienen valores residuales en model_values`);
      console.log(`   Esto significa que los valores NO fueron eliminados después del archivado`);
    }
    if (modelosConArchivoIncompleto > 0) {
      console.log(`⚠️ ADVERTENCIA: ${modelosConArchivoIncompleto} modelos tienen archivo incompleto`);
      console.log(`   Algunos registros no tienen todos los campos calculados`);
    }
    if (modelosSinArchivo === 0 && modelosConValoresResiduales === 0 && modelosConArchivoIncompleto === 0) {
      console.log(`✅ TODO CORRECTO: Todos los modelos tienen archivo completo y sin valores residuales`);
    }

    // 7. Exportar resultados a JSON
    const fs = require('fs');
    const reportePath = `reporte_verificacion_archivado_${periodDate}_${periodType.replace('-', '_')}.json`;
    fs.writeFileSync(reportePath, JSON.stringify({
      periodo: { period_date: periodDate, period_type: periodType },
      fecha_verificacion: new Date().toISOString(),
      resumen: {
        total_modelos: models.length,
        modelos_con_archivo: modelosConArchivo,
        modelos_sin_archivo: modelosSinArchivo,
        modelos_con_valores_residuales: modelosConValoresResiduales,
        modelos_con_archivo_incompleto: modelosConArchivoIncompleto
      },
      resultados: resultados
    }, null, 2));
    console.log(`\n💾 Reporte completo guardado en: ${reportePath}`);

  } catch (error) {
    console.error('❌ Error crítico:', error);
    process.exit(1);
  }
}

// Ejecutar
const periodDate = process.argv[2] || '2025-12-16';
const periodType = process.argv[3] || '16-31';

verificarArchivado(periodDate, periodType)
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

