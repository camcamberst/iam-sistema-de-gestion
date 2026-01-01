/**
 * 🚨 SCRIPT DE EMERGENCIA: Archivar P2 de Diciembre 2025
 * 
 * Este script archiva los valores por plataforma del período 16-31 de diciembre
 * que aún están en model_values en producción
 * 
 * IMPORTANTE: Este script:
 * 1. Lee valores de model_values (solo hasta las 23:59:59 del último día del período)
 * 2. Los archiva en calculator_history con detalle por plataforma
 * 3. VERIFICA que se insertaron correctamente
 * 4. NO ELIMINA valores de model_values (se mantienen para verificación)
 * 
 * Una vez verificado que los datos están archivados correctamente,
 * puedes ejecutar otro script para eliminar los valores residuales si lo deseas.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Importar la función de cálculo de USD bruto
function calculateUsdBruto(value, platformId, currency, rates) {
  const normalizedId = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (currency === 'EUR') {
    if (normalizedId === 'big7') return (value * rates.eur_usd) * 0.84;
    else if (normalizedId === 'mondo') return (value * rates.eur_usd) * 0.78;
    else return value * rates.eur_usd;
  } else if (currency === 'GBP') {
    if (normalizedId === 'aw') return (value * rates.gbp_usd) * 0.677;
    else return value * rates.gbp_usd;
  } else if (currency === 'USD') {
    if (normalizedId === 'cmd' || normalizedId === 'camlust' || normalizedId === 'skypvt') return value * 0.75;
    else if (normalizedId === 'chaturbate' || normalizedId === 'myfreecams' || normalizedId === 'stripchat') return value * 0.05;
    else if (normalizedId === 'dxlive') return value * 0.60;
    else if (normalizedId === 'secretfriends') return value * 0.5;
    else if (normalizedId === 'superfoon') return value;
    else return value;
  }
  return 0;
}

async function archivarP2Diciembre() {
  console.log('\n🚨 ARCHIVADO DE EMERGENCIA: P2 de Diciembre 2025');
  console.log('='.repeat(60));
  console.log('📅 Período: 16-31 de Diciembre 2025');
  console.log('📅 Rango: 2025-12-16 a 2025-12-31');
  console.log('='.repeat(60));

  const periodDate = '2025-12-16';
  const periodType = '16-31';
  const startDate = '2025-12-16';
  const endDate = '2025-12-31';

  try {
    // 1. Obtener tasas activas
    console.log('\n📋 Paso 1: Obteniendo tasas activas...');
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) {
      console.error('❌ Error obteniendo tasas:', ratesError);
      return;
    }

    const rates = {
      eur_usd: ratesData?.find(r => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find(r => r.kind === 'GBP→USD')?.value || 1.20,
      usd_cop: ratesData?.find(r => r.kind === 'USD→COP')?.value || 3900
    };

    console.log(`✅ Tasas obtenidas: EUR→USD: ${rates.eur_usd}, GBP→USD: ${rates.gbp_usd}, USD→COP: ${rates.usd_cop}`);

    // 2. Obtener información de plataformas
    console.log('\n📋 Paso 2: Obteniendo información de plataformas...');
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, currency')
      .eq('active', true);

    if (platformsError) {
      console.error('❌ Error obteniendo plataformas:', platformsError);
      return;
    }

    const platformMap = new Map(platforms.map(p => [p.id, p]));
    console.log(`✅ ${platforms.length} plataformas activas obtenidas`);

    // 3. Obtener todos los modelos con valores en el período
    // IMPORTANTE: Solo valores registrados hasta las 23:59:59 del último día del período
    console.log('\n📋 Paso 3: Obteniendo modelos con valores en el período...');
    console.log(`   📅 Rango de fechas: ${startDate} a ${endDate}`);
    console.log(`   ⏰ Solo valores hasta: ${endDate} 23:59:59`);
    
    const fechaLimite = new Date(`${endDate}T23:59:59.999Z`);
    const fechaLimiteISO = fechaLimite.toISOString();
    
    const { data: valores, error: valoresError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, updated_at, period_date')
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .lte('updated_at', fechaLimiteISO);

    if (valoresError) {
      console.error('❌ Error obteniendo valores:', valoresError);
      return;
    }

    if (!valores || valores.length === 0) {
      console.log('⚠️ No hay valores para archivar en el período');
      return;
    }

    console.log(`✅ Encontrados ${valores.length} valores para archivar`);

    // Agrupar por modelo y plataforma (tomar el último valor por plataforma)
    const valoresPorModelo = new Map();
    valores.forEach(v => {
      if (!valoresPorModelo.has(v.model_id)) {
        valoresPorModelo.set(v.model_id, new Map());
      }
      const porPlataforma = valoresPorModelo.get(v.model_id);
      const existente = porPlataforma.get(v.platform_id);
      if (!existente || new Date(v.updated_at) > new Date(existente.updated_at)) {
        porPlataforma.set(v.platform_id, v);
      }
    });

    console.log(`✅ ${valoresPorModelo.size} modelos con valores para archivar`);

    // 4. Obtener emails de los modelos
    const modelIds = Array.from(valoresPorModelo.keys());
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', modelIds);

    const emailMap = new Map();
    if (users) {
      users.forEach(u => emailMap.set(u.id, u.email));
    }

    // 5. Para cada modelo, archivar valores
    console.log('\n📋 Paso 4: Archivando valores por modelo...');
    const resultados = [];
    let exitosos = 0;
    let errores = 0;

    for (const [modelId, valoresPorPlataforma] of valoresPorModelo.entries()) {
      const email = emailMap.get(modelId) || modelId;
      console.log(`\n📧 Procesando: ${email} (${valoresPorPlataforma.size} plataformas)`);

      const resultado = {
        model_id: modelId,
        email,
        plataformas: valoresPorPlataforma.size,
        archivados: 0,
        eliminados: 0,
        error: null
      };

      try {
        // 5.1. Obtener configuración del modelo
        const { data: config, error: configError } = await supabase
          .from('calculator_config')
          .select('percentage_override, group_percentage')
          .eq('model_id', modelId)
          .eq('active', true)
          .single();

        if (configError && configError.code !== 'PGRST116') {
          throw configError;
        }

        const modelPercentage = config?.percentage_override || config?.group_percentage || 80;

        // 5.2. Preparar registros históricos
        const historyInserts = [];
        for (const [platformId, valor] of valoresPorPlataforma.entries()) {
          const platform = platformMap.get(platformId);
          const currency = platform?.currency || 'USD';
          const valueNum = Number(valor.value) || 0;

          if (valueNum <= 0) continue;

          const valueUsdBruto = calculateUsdBruto(valueNum, platformId, currency, rates);
          const valueUsdModelo = valueUsdBruto * (modelPercentage / 100);
          const valueCopModelo = valueUsdModelo * rates.usd_cop;

          historyInserts.push({
            model_id: modelId,
            platform_id: platformId,
            period_date: startDate,
            period_type: periodType,
            value: parseFloat(valueNum.toFixed(2)),
            rate_eur_usd: rates.eur_usd,
            rate_gbp_usd: rates.gbp_usd,
            rate_usd_cop: rates.usd_cop,
            platform_percentage: modelPercentage,
            value_usd_bruto: parseFloat(valueUsdBruto.toFixed(2)),
            value_usd_modelo: parseFloat(valueUsdModelo.toFixed(2)),
            value_cop_modelo: parseFloat(valueCopModelo.toFixed(2)),
            archived_at: new Date().toISOString(),
            original_updated_at: valor.updated_at
          });
        }

        if (historyInserts.length === 0) {
          console.log(`   ⚠️ No hay valores válidos para archivar`);
          resultado.error = 'No hay valores válidos';
          errores++;
          resultados.push(resultado);
          continue;
        }

        // 5.3. Insertar en calculator_history
        console.log(`   📝 Archivando ${historyInserts.length} registros...`);
        const { error: insertError } = await supabase
          .from('calculator_history')
          .upsert(historyInserts, {
            onConflict: 'model_id,platform_id,period_date,period_type',
            ignoreDuplicates: false
          });

        if (insertError) {
          throw insertError;
        }

        // 5.4. VALIDACIÓN CRÍTICA: Verificar que se insertaron
        console.log(`   🔍 Verificando inserción...`);
        const { data: verificationData, error: verificationError } = await supabase
          .from('calculator_history')
          .select('id, platform_id')
          .eq('model_id', modelId)
          .eq('period_date', startDate)
          .eq('period_type', periodType);

        if (verificationError) {
          throw new Error(`Error verificando: ${verificationError.message}`);
        }

        const verifiedCount = verificationData?.length || 0;
        if (verifiedCount < historyInserts.length) {
          throw new Error(`Validación fallida: Se intentaron insertar ${historyInserts.length} pero solo se verificaron ${verifiedCount}`);
        }

        console.log(`   ✅ ${verifiedCount} registros archivados y verificados`);

        // 5.5. NO ELIMINAR valores de model_values - Solo archivar
        // IMPORTANTE: Este script SOLO archiva, NO elimina valores
        // Los valores se mantienen en model_values para verificación
        console.log(`   ✅ Valores archivados correctamente. Los valores se mantienen en model_values para verificación.`);

        resultado.archivados = verifiedCount;
        resultado.eliminados = 0; // No se eliminan valores en este script
        exitosos++;
        resultados.push(resultado);

      } catch (error) {
        resultado.error = error instanceof Error ? error.message : 'Error desconocido';
        console.error(`   ❌ Error: ${resultado.error}`);
        errores++;
        resultados.push(resultado);
      }
    }

    // 6. Reporte final
    console.log('\n📊 REPORTE FINAL');
    console.log('='.repeat(60));
    console.log(`✅ Exitosos: ${exitosos}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total procesados: ${resultados.length}`);

    if (exitosos > 0) {
      const totalArchivados = resultados.filter(r => !r.error).reduce((sum, r) => sum + r.archivados, 0);
      console.log(`\n✅ Total registros archivados: ${totalArchivados}`);
      console.log(`⚠️ IMPORTANTE: Los valores NO fueron eliminados de model_values`);
      console.log(`   Los valores se mantienen para que puedas verificar el archivado`);
      console.log(`   Una vez verificado, puedes eliminarlos manualmente si lo deseas`);
    }

    if (errores > 0) {
      console.log('\n❌ MODELOS CON ERRORES:');
      resultados.filter(r => r.error).forEach(r => {
        console.log(`   ❌ ${r.email}: ${r.error}`);
      });
    }

    // 7. Verificación final
    console.log('\n🔍 VERIFICACIÓN FINAL');
    console.log('='.repeat(60));
    const fechaLimiteFinal = new Date(`${endDate}T23:59:59.999Z`);
    const fechaLimiteISOFinal = fechaLimiteFinal.toISOString();
    
    // Verificar que los valores aún están en model_values (no se eliminaron)
    const { data: valoresEnModelValues, error: valoresVerificacionError } = await supabase
      .from('model_values')
      .select('model_id')
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .lte('updated_at', fechaLimiteISO);

    if (valoresVerificacionError) {
      console.error('❌ Error verificando valores en model_values:', valoresVerificacionError);
    } else {
      const valoresCount = valoresEnModelValues?.length || 0;
      console.log(`✅ Valores en model_values: ${valoresCount} (se mantienen para verificación)`);
      console.log(`   Estos valores NO fueron eliminados para que puedas verificar el archivado`);
      console.log(`   Una vez verificado, puedes ejecutar el script de eliminación si lo deseas`);
    }

    // 8. Verificar archivo en calculator_history
    const { data: archivoFinal, error: archivoError } = await supabase
      .from('calculator_history')
      .select('model_id, platform_id')
      .eq('period_date', startDate)
      .eq('period_type', periodType);

    if (!archivoError && archivoFinal) {
      const modelosConArchivo = new Set(archivoFinal.map(a => a.model_id));
      const plataformasArchivadas = new Set(archivoFinal.map(a => a.platform_id));
      console.log(`\n✅ Archivo en calculator_history:`);
      console.log(`   Modelos archivados: ${modelosConArchivo.size}`);
      console.log(`   Plataformas archivadas: ${plataformasArchivadas.size}`);
      console.log(`   Total registros: ${archivoFinal.length}`);
    }

    // 9. Exportar reporte
    const fs = require('fs');
    const reportePath = `reporte_archivado_emergencia_p2_diciembre.json`;
    fs.writeFileSync(reportePath, JSON.stringify({
      fecha_archivado: new Date().toISOString(),
      periodo: { period_date: periodDate, period_type: periodType },
      resumen: {
        total_modelos: resultados.length,
        exitosos,
        errores
      },
      resultados: resultados
    }, null, 2));
    console.log(`\n💾 Reporte guardado en: ${reportePath}`);

  } catch (error) {
    console.error('❌ Error crítico:', error);
    process.exit(1);
  }
}

archivarP2Diciembre()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

