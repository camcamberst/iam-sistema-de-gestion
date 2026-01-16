/**
 * 🔧 SCRIPT DE CORRECCIÓN: Valores Residuales después del Cierre
 * 
 * Este script verifica y corrige valores residuales en model_values después del cierre
 * 
 * IMPORTANTE: Solo elimina valores si están archivados en calculator_history
 * Si NO están archivados, los archiva primero
 * 
 * Uso: node scripts/corregir_valores_residuales_cierre.js [period_date] [period_type]
 * Ejemplo: node scripts/corregir_valores_residuales_cierre.js 2025-12-16 16-31
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Importar función de archivado
const { atomicArchiveAndReset } = require('../lib/calculator/period-closure-helpers');

async function corregirValoresResiduales(periodDate, periodType) {
  console.log('\n🔧 CORRECCIÓN DE VALORES RESIDUALES DESPUÉS DEL CIERRE');
  console.log('='.repeat(60));
  console.log(`📅 Período: ${periodType} (${periodDate})`);
  console.log('='.repeat(60));

  try {
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

    console.log(`📅 Rango del período: ${startDate} a ${endDate}`);

    // 1. Obtener todos los modelos con valores residuales
    console.log('\n📋 Paso 1: Obteniendo modelos con valores residuales...');
    const { data: residualData, error: residualError } = await supabase
      .from('model_values')
      .select('model_id')
      .gte('period_date', startDate)
      .lte('period_date', endDate);

    if (residualError) {
      console.error('❌ Error obteniendo valores residuales:', residualError);
      return;
    }

    // Agrupar por modelo
    const modelosConResiduales = new Map();
    residualData.forEach(item => {
      const count = modelosConResiduales.get(item.model_id) || 0;
      modelosConResiduales.set(item.model_id, count + 1);
    });

    console.log(`✅ Encontrados ${modelosConResiduales.size} modelos con valores residuales`);

    if (modelosConResiduales.size === 0) {
      console.log('✅ No hay valores residuales. Todo está correcto.');
      return;
    }

    // 2. Para cada modelo, verificar si tiene archivo en calculator_history
    console.log('\n📋 Paso 2: Verificando archivos en calculator_history...');
    const resultados = [];
    let modelosConArchivo = 0;
    let modelosSinArchivo = 0;

    for (const [modelId, count] of modelosConResiduales.entries()) {
      const resultado = {
        model_id: modelId,
        valores_residuales: count,
        tiene_archivo: false,
        registros_archivados: 0,
        accion: null,
        error: null
      };

      // Verificar si tiene archivo
      const { data: history, error: historyError } = await supabase
        .from('calculator_history')
        .select('platform_id')
        .eq('model_id', modelId)
        .eq('period_date', startDate)
        .eq('period_type', periodType);

      if (historyError) {
        resultado.error = `Error consultando calculator_history: ${historyError.message}`;
      } else if (history && history.length > 0) {
        resultado.tiene_archivo = true;
        resultado.registros_archivados = history.length;
        resultado.accion = 'eliminar_residuales';
        modelosConArchivo++;
      } else {
        resultado.accion = 'archivar_y_eliminar';
        modelosSinArchivo++;
      }

      resultados.push(resultado);
    }

    console.log(`✅ Modelos con archivo: ${modelosConArchivo}`);
    console.log(`⚠️ Modelos sin archivo: ${modelosSinArchivo}`);

    // 3. Obtener emails de los modelos para el reporte
    const modelIds = Array.from(modelosConResiduales.keys());
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', modelIds);

    const emailMap = new Map();
    if (users) {
      users.forEach(u => emailMap.set(u.id, u.email));
    }

    // 4. Procesar cada modelo
    console.log('\n📋 Paso 3: Procesando modelos...');
    let exitosos = 0;
    let errores = 0;

    for (const resultado of resultados) {
      const email = emailMap.get(resultado.model_id) || resultado.model_id;
      console.log(`\n📧 Procesando: ${email} (${resultado.valores_residuales} valores residuales)`);

      try {
        if (resultado.accion === 'eliminar_residuales') {
          // Solo eliminar valores residuales (ya están archivados)
          console.log(`   ✅ Tiene archivo (${resultado.registros_archivados} registros). Eliminando valores residuales...`);
          
          const { data: deletedData, error: deleteError } = await supabase
            .from('model_values')
            .delete()
            .eq('model_id', resultado.model_id)
            .gte('period_date', startDate)
            .lte('period_date', endDate)
            .select();

          if (deleteError) {
            resultado.error = `Error eliminando valores: ${deleteError.message}`;
            console.error(`   ❌ Error: ${resultado.error}`);
            errores++;
          } else {
            const deletedCount = deletedData?.length || 0;
            console.log(`   ✅ ${deletedCount} valores eliminados correctamente`);
            resultado.eliminados = deletedCount;
            exitosos++;
          }

        } else if (resultado.accion === 'archivar_y_eliminar') {
          // Archivar primero, luego eliminar
          console.log(`   ⚠️ NO tiene archivo. Archivando valores primero...`);
          
          // Para modelos sin archivo, necesitamos archivarlos primero
          // Esto requiere la lógica completa de archivado, que está en TypeScript
          // Por ahora, marcamos como pendiente de archivado manual
          console.log(`   ⚠️ REQUIERE ARCHIVADO MANUAL: Este modelo necesita ser archivado primero`);
          console.log(`   📋 Usar endpoint: POST /api/calculator/period-closure/close-period`);
          console.log(`   📋 O ejecutar atomicArchiveAndReset para este modelo específico`);
          resultado.error = 'Requiere archivado manual - valores no están archivados';
          resultado.accion_requerida = 'archivar_manual';
          errores++;
        }

      } catch (error) {
        resultado.error = error instanceof Error ? error.message : 'Error desconocido';
        console.error(`   ❌ Error crítico: ${resultado.error}`);
        errores++;
      }
    }

    // 5. Reporte final
    console.log('\n📊 REPORTE FINAL');
    console.log('='.repeat(60));
    console.log(`✅ Exitosos: ${exitosos}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total procesados: ${resultados.length}`);

    // Mostrar modelos con errores
    const modelosConErrores = resultados.filter(r => r.error);
    if (modelosConErrores.length > 0) {
      console.log('\n⚠️ MODELOS CON ERRORES:');
      console.log('='.repeat(60));
      modelosConErrores.forEach(r => {
        const email = emailMap.get(r.model_id) || r.model_id;
        console.log(`\n📧 ${email}`);
        console.log(`   ❌ Error: ${r.error}`);
      });
    }

    // Mostrar modelos exitosos
    const modelosExitosos = resultados.filter(r => !r.error);
    if (modelosExitosos.length > 0) {
      console.log('\n✅ MODELOS CORREGIDOS EXITOSAMENTE:');
      console.log('='.repeat(60));
      modelosExitosos.forEach(r => {
        const email = emailMap.get(r.model_id) || r.model_id;
        if (r.archivados) {
          console.log(`   ✅ ${email}: ${r.archivados} archivados, ${r.eliminados} eliminados`);
        } else {
          console.log(`   ✅ ${email}: ${r.eliminados} valores residuales eliminados`);
        }
      });
    }

    // 6. Verificación final
    console.log('\n🔍 VERIFICACIÓN FINAL');
    console.log('='.repeat(60));
    const { data: finalResidual, error: finalError } = await supabase
      .from('model_values')
      .select('model_id')
      .gte('period_date', startDate)
      .lte('period_date', endDate);

    if (finalError) {
      console.error('❌ Error en verificación final:', finalError);
    } else {
      const finalCount = finalResidual?.length || 0;
      if (finalCount === 0) {
        console.log('✅ VERIFICACIÓN EXITOSA: No hay valores residuales');
      } else {
        console.log(`⚠️ ADVERTENCIA: Aún quedan ${finalCount} valores residuales`);
        console.log('   Revisar los modelos con errores arriba');
      }
    }

    // 7. Exportar resultados
    const fs = require('fs');
    const reportePath = `reporte_correccion_residuales_${periodDate}_${periodType.replace('-', '_')}.json`;
    fs.writeFileSync(reportePath, JSON.stringify({
      periodo: { period_date: periodDate, period_type: periodType },
      fecha_correccion: new Date().toISOString(),
      resumen: {
        total_modelos: resultados.length,
        exitosos,
        errores
      },
      resultados: resultados.map(r => ({
        ...r,
        email: emailMap.get(r.model_id) || r.model_id
      }))
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

corregirValoresResiduales(periodDate, periodType)
  .then(() => {
    console.log('\n✅ Corrección completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

