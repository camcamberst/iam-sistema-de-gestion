/**
 * 🗑️ SCRIPT: Eliminar Valores de P2 de Diciembre (Ejecución Directa)
 * 
 * Este script ejecuta la lógica de eliminación directamente usando service role
 * No requiere autenticación de usuario ya que usa service role key
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Faltan variables de entorno');
  console.error('   Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function eliminarValoresDirecto() {
  console.log('\n🗑️ ELIMINACIÓN DIRECTA DE VALORES: P2 de Diciembre 2025');
  console.log('='.repeat(60));
  console.log('📅 Período: 16-31 de Diciembre 2025');
  console.log('📅 Rango: 2025-12-16 a 2025-12-31');
  console.log('⏰ Solo valores hasta: 2025-12-31 23:59:59');
  console.log('='.repeat(60));

  const startDate = '2025-12-16';
  const endDate = '2025-12-31';
  const periodType = '16-31';
  const fechaLimite = new Date(`${endDate}T23:59:59.999Z`);
  const fechaLimiteISO = fechaLimite.toISOString();

  try {
    // 1. Obtener modelos con valores en el período
    console.log('\n📋 Paso 1: Obteniendo modelos con valores en el período...');
    const { data: valores, error: valoresError } = await supabase
      .from('model_values')
      .select('model_id')
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .lte('updated_at', fechaLimiteISO);

    if (valoresError) {
      console.error('❌ Error obteniendo valores:', valoresError);
      return;
    }

    if (!valores || valores.length === 0) {
      console.log('✅ No hay valores para eliminar');
      return;
    }

    // Agrupar por modelo
    const modelosConValores = Array.from(new Set(valores.map(v => v.model_id)));
    console.log(`✅ Encontrados ${modelosConValores.length} modelos con valores`);

    // 2. Obtener emails
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', modelosConValores);

    const emailMap = new Map(users?.map(u => [u.id, u.email]) || []);

    // 3. Verificar que cada modelo tiene archivo
    console.log('\n📋 Paso 2: Verificando que los modelos tienen archivo...');
    const resultados = [];
    let modelosConArchivo = 0;
    let modelosSinArchivo = 0;

    for (const modelId of modelosConValores) {
      const email = emailMap.get(modelId) || modelId;
      const resultado = {
        model_id: modelId,
        email,
        tiene_archivo: false,
        registros_archivados: 0,
        valores_eliminados: 0,
        error: null
      };

      // Verificar archivo
      const { data: archivo, error: archivoError } = await supabase
        .from('calculator_history')
        .select('platform_id')
        .eq('model_id', modelId)
        .eq('period_date', startDate)
        .eq('period_type', periodType);

      if (!archivoError && archivo && archivo.length > 0) {
        resultado.tiene_archivo = true;
        resultado.registros_archivados = archivo.length;
        modelosConArchivo++;
      } else {
        modelosSinArchivo++;
        resultado.error = 'No tiene archivo en calculator_history';
      }

      resultados.push(resultado);
    }

    console.log(`✅ Modelos con archivo: ${modelosConArchivo}`);
    console.log(`❌ Modelos sin archivo: ${modelosSinArchivo}`);

    if (modelosSinArchivo > 0) {
      console.log('\n⚠️ MODELOS SIN ARCHIVO (no se eliminarán valores):');
      resultados.filter(r => !r.tiene_archivo).forEach(r => {
        console.log(`   - ${r.email}`);
      });
    }

    // 4. Eliminar valores SOLO de modelos con archivo
    console.log('\n📋 Paso 3: Eliminando valores (solo modelos con archivo)...');
    let exitosos = 0;
    let errores = 0;
    let totalEliminados = 0;

    for (const resultado of resultados) {
      if (!resultado.tiene_archivo) {
        console.log(`\n⚠️ ${resultado.email}: NO tiene archivo, se omite`);
        errores++;
        continue;
      }

      console.log(`\n📧 ${resultado.email} (${resultado.registros_archivados} registros archivados)`);
      console.log(`   🗑️ Eliminando valores de model_values...`);

      try {
        const { data: deletedData, error: deleteError } = await supabase
          .from('model_values')
          .delete()
          .eq('model_id', resultado.model_id)
          .gte('period_date', startDate)
          .lte('period_date', endDate)
          .lte('updated_at', fechaLimiteISO)
          .select();

        if (deleteError) {
          resultado.error = `Error eliminando: ${deleteError.message}`;
          console.error(`   ❌ Error: ${resultado.error}`);
          errores++;
        } else {
          const deletedCount = deletedData?.length || 0;
          resultado.valores_eliminados = deletedCount;
          totalEliminados += deletedCount;
          console.log(`   ✅ ${deletedCount} valores eliminados`);
          exitosos++;
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
    console.log(`⚠️ Modelos sin archivo (no eliminados): ${modelosSinArchivo}`);
    console.log(`🗑️ Total valores eliminados: ${totalEliminados}`);

    // 6. Verificación final
    console.log('\n🔍 VERIFICACIÓN FINAL');
    console.log('='.repeat(60));
    const { data: finalValores } = await supabase
      .from('model_values')
      .select('model_id')
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .lte('updated_at', fechaLimiteISO);

    const residuales = finalValores?.length || 0;
    if (residuales === 0) {
      console.log('✅ VERIFICACIÓN EXITOSA: No quedan valores residuales');
    } else {
      console.log(`⚠️ Aún quedan ${residuales} valores residuales`);
      console.log('   Estos son de modelos que no tienen archivo o tuvieron errores');
    }

    // 7. Exportar reporte
    const fs = require('fs');
    const reportePath = `reporte_eliminacion_valores_p2_diciembre_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportePath, JSON.stringify({
      fecha_eliminacion: new Date().toISOString(),
      periodo: { period_date: startDate, period_type: periodType },
      resumen: {
        total_modelos: resultados.length,
        exitosos,
        errores,
        modelos_sin_archivo: modelosSinArchivo,
        total_eliminados: totalEliminados,
        residuales_restantes: residuales
      },
      resultados: resultados
    }, null, 2));
    console.log(`\n💾 Reporte guardado en: ${reportePath}`);

  } catch (error) {
    console.error('❌ Error crítico:', error);
    process.exit(1);
  }
}

eliminarValoresDirecto()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });





