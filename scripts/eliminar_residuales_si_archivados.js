/**
 * 🔧 SCRIPT SIMPLIFICADO: Eliminar Valores Residuales (Solo si están archivados)
 * 
 * Este script elimina valores residuales SOLO si están archivados en calculator_history
 * NO archiva valores nuevos - solo limpia residuales de modelos que ya tienen archivo
 * 
 * Uso: node scripts/eliminar_residuales_si_archivados.js [period_date] [period_type]
 * Ejemplo: node scripts/eliminar_residuales_si_archivados.js 2025-12-16 16-31
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function eliminarResidualesSiArchivados(periodDate, periodType) {
  console.log('\n🔧 ELIMINACIÓN DE VALORES RESIDUALES (Solo si están archivados)');
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

    // 2. Obtener emails de los modelos
    const modelIds = Array.from(modelosConResiduales.keys());
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', modelIds);

    const emailMap = new Map();
    if (users) {
      users.forEach(u => emailMap.set(u.id, u.email));
    }

    // 3. Para cada modelo, verificar si tiene archivo
    console.log('\n📋 Paso 2: Verificando archivos en calculator_history...');
    const resultados = [];
    let modelosConArchivo = 0;
    let modelosSinArchivo = 0;

    for (const [modelId, count] of modelosConResiduales.entries()) {
      const email = emailMap.get(modelId) || modelId;
      const resultado = {
        model_id: modelId,
        email,
        valores_residuales: count,
        tiene_archivo: false,
        registros_archivados: 0,
        eliminados: 0,
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
        modelosConArchivo++;
      } else {
        modelosSinArchivo++;
      }

      resultados.push(resultado);
    }

    console.log(`✅ Modelos con archivo: ${modelosConArchivo}`);
    console.log(`⚠️ Modelos sin archivo: ${modelosSinArchivo}`);

    // 4. Eliminar valores residuales SOLO de modelos con archivo
    console.log('\n📋 Paso 3: Eliminando valores residuales (solo modelos con archivo)...');
    let exitosos = 0;
    let errores = 0;
    let pendientes = 0;

    for (const resultado of resultados) {
      console.log(`\n📧 ${resultado.email} (${resultado.valores_residuales} valores residuales)`);

      if (resultado.tiene_archivo) {
        // Eliminar valores residuales
        console.log(`   ✅ Tiene archivo (${resultado.registros_archivados} registros). Eliminando valores residuales...`);
        
        try {
          const { data: deletedData, error: deleteError } = await supabase
            .from('model_values')
            .delete()
            .eq('model_id', resultado.model_id)
            .gte('period_date', startDate)
            .lte('period_date', endDate)
            .select();

          if (deleteError) {
            resultado.error = `Error eliminando: ${deleteError.message}`;
            console.error(`   ❌ Error: ${resultado.error}`);
            errores++;
          } else {
            const deletedCount = deletedData?.length || 0;
            resultado.eliminados = deletedCount;
            console.log(`   ✅ ${deletedCount} valores eliminados correctamente`);
            exitosos++;
          }
        } catch (error) {
          resultado.error = error instanceof Error ? error.message : 'Error desconocido';
          console.error(`   ❌ Error crítico: ${resultado.error}`);
          errores++;
        }
      } else {
        // No tiene archivo - requiere archivado primero
        console.log(`   ⚠️ NO tiene archivo. REQUIERE ARCHIVADO PRIMERO antes de eliminar.`);
        resultado.error = 'Requiere archivado manual - valores no están archivados';
        pendientes++;
      }
    }

    // 5. Reporte final
    console.log('\n📊 REPORTE FINAL');
    console.log('='.repeat(60));
    console.log(`✅ Exitosos (eliminados): ${exitosos}`);
    console.log(`⚠️ Pendientes (requieren archivado): ${pendientes}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total procesados: ${resultados.length}`);

    // Mostrar modelos pendientes
    const modelosPendientes = resultados.filter(r => !r.tiene_archivo);
    if (modelosPendientes.length > 0) {
      console.log('\n⚠️ MODELOS QUE REQUIEREN ARCHIVADO MANUAL:');
      console.log('='.repeat(60));
      console.log('Estos modelos tienen valores residuales pero NO están archivados.');
      console.log('DEBEN ser archivados ANTES de eliminar los valores residuales.');
      console.log('\nOpciones:');
      console.log('1. Usar endpoint API: POST /api/calculator/period-closure/close-period');
      console.log('2. Ejecutar atomicArchiveAndReset para cada modelo');
      console.log('3. Contactar al equipo de desarrollo\n');
      
      modelosPendientes.forEach(r => {
        console.log(`   📧 ${r.email}: ${r.valores_residuales} valores residuales`);
      });
    }

    // Mostrar modelos con errores
    const modelosConErrores = resultados.filter(r => r.error && r.tiene_archivo);
    if (modelosConErrores.length > 0) {
      console.log('\n❌ MODELOS CON ERRORES:');
      console.log('='.repeat(60));
      modelosConErrores.forEach(r => {
        console.log(`   📧 ${r.email}: ${r.error}`);
      });
    }

    // Mostrar modelos exitosos
    const modelosExitosos = resultados.filter(r => r.tiene_archivo && !r.error);
    if (modelosExitosos.length > 0) {
      console.log('\n✅ MODELOS CORREGIDOS EXITOSAMENTE:');
      console.log('='.repeat(60));
      modelosExitosos.forEach(r => {
        console.log(`   ✅ ${r.email}: ${r.eliminados} valores residuales eliminados`);
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
        // Agrupar por modelo
        const finalByModel = new Map();
        finalResidual.forEach(item => {
          const count = finalByModel.get(item.model_id) || 0;
          finalByModel.set(item.model_id, count + 1);
        });
        
        console.log(`⚠️ ADVERTENCIA: Aún quedan ${finalCount} valores residuales en ${finalByModel.size} modelos`);
        console.log('   Estos son modelos que requieren archivado manual primero');
      }
    }

    // 7. Exportar resultados
    const fs = require('fs');
    const reportePath = `reporte_eliminacion_residuales_${periodDate}_${periodType.replace('-', '_')}.json`;
    fs.writeFileSync(reportePath, JSON.stringify({
      periodo: { period_date: periodDate, period_type: periodType },
      fecha_correccion: new Date().toISOString(),
      resumen: {
        total_modelos: resultados.length,
        exitosos,
        pendientes,
        errores
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

eliminarResidualesSiArchivados(periodDate, periodType)
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });







