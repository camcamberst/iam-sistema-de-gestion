
export const dynamic = 'force-dynamic';

/**
 * 🚨 ENDPOINT DE EMERGENCIA: Archivar P2 de Diciembre 2025
 * 
 * Este endpoint archiva los valores por plataforma del período 16-31 de diciembre
 * que aún están en model_values en producción
 * 
 * IMPORTANTE: 
 * - Solo ejecutar si los datos están en producción y NO están archivados
 * - Este endpoint SOLO archiva, NO elimina valores de model_values
 * - Los valores se mantienen en model_values para verificación
 * - Una vez verificado, puedes eliminar los valores residuales manualmente
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Helper para verificar autenticación y rol de admin
async function authenticateAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  console.log('🔐 [AUTH] Verificando autenticación...');
  console.log('🔐 [AUTH] Header authorization:', authHeader ? 'Presente' : 'Ausente');
  
  if (!authHeader) {
    console.error('❌ [AUTH] No hay header de autorización');
    return { error: 'Token de autorización requerido', user: null };
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    console.error('❌ [AUTH] Header no tiene formato Bearer');
    return { error: 'Token de autorización requerido', user: null };
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.error('❌ [AUTH] Token vacío');
    return { error: 'Token de autorización requerido', user: null };
  }
  
  console.log('🔐 [AUTH] Token obtenido, verificando con Supabase...');
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) {
    console.error('❌ [AUTH] Error verificando token:', error.message);
    return { error: `Token inválido: ${error.message}`, user: null };
  }
  
  if (!user) {
    console.error('❌ [AUTH] Usuario no encontrado');
    return { error: 'Token inválido', user: null };
  }
  
  console.log('✅ [AUTH] Usuario autenticado:', user.id);

  // Verificar rol del usuario
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userError) {
    console.error('❌ [AUTH] Error obteniendo datos de usuario:', userError.message);
    return { error: `Error obteniendo datos de usuario: ${userError.message}`, user: null };
  }
  
  if (!userData) {
    console.error('❌ [AUTH] Datos de usuario no encontrados');
    return { error: 'Error obteniendo datos de usuario', user: null };
  }
  
  console.log('🔐 [AUTH] Rol del usuario:', userData.role);

  // Solo permitir admin y super_admin
  if (userData.role !== 'admin' && userData.role !== 'super_admin') {
    console.error('❌ [AUTH] Rol no autorizado:', userData.role);
    return { error: 'No autorizado. Se requiere rol de admin o super_admin', user: null };
  }
  
  console.log('✅ [AUTH] Autenticación exitosa para:', userData.role);

  return { error: null, user: { id: user.id, role: userData.role } };
}

const supabase = createClient(supabaseUrl, supabaseKey);

function calculateUsdBruto(value: number, platformId: string, currency: string, rates: any): number {
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

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación y rol de admin
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const periodDate = '2025-12-16';
    const periodType = '16-31';
    const startDate = '2025-12-16';
    const endDate = '2025-12-31';

    console.log('🚨 [EMERGENCY-ARCHIVE] Iniciando archivado de emergencia para P2 de diciembre...');

    // 1. Obtener tasas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) throw ratesError;

    const rates = {
      eur_usd: ratesData?.find(r => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find(r => r.kind === 'GBP→USD')?.value || 1.20,
      usd_cop: ratesData?.find(r => r.kind === 'USD→COP')?.value || 3900
    };

    // 2. Obtener plataformas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, currency')
      .eq('active', true);

    if (platformsError) throw platformsError;

    const platformMap = new Map(platforms.map(p => [p.id, p]));

    // 3. Obtener valores
    // IMPORTANTE: Obtener TODOS los valores del período, luego filtrar por updated_at
    // para tomar solo los que estaban vigentes al final del período (31 dic 23:59:59)
    const fechaLimite = new Date(`${endDate}T23:59:59.999Z`);
    const fechaLimiteISO = fechaLimite.toISOString();
    
    console.log(`📅 [EMERGENCY-ARCHIVE] Rango: ${startDate} a ${endDate}`);
    console.log(`⏰ [EMERGENCY-ARCHIVE] Solo valores hasta: ${fechaLimiteISO}`);
    
    // Obtener TODOS los valores del período (sin filtrar por updated_at en la consulta)
    const { data: todosLosValores, error: valoresError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, updated_at, period_date')
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .order('updated_at', { ascending: false });

    if (valoresError) throw valoresError;

    if (!todosLosValores || todosLosValores.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay valores para archivar en el período especificado'
      }, { status: 404 });
    }

    console.log(`📦 [EMERGENCY-ARCHIVE] Total valores encontrados: ${todosLosValores.length}`);

    // Filtrar valores que estaban vigentes al final del período
    const valoresVigentes = todosLosValores.filter(v => {
      const updatedAt = new Date(v.updated_at);
      return updatedAt <= fechaLimite;
    });

    console.log(`📦 [EMERGENCY-ARCHIVE] Valores vigentes hasta ${fechaLimiteISO}: ${valoresVigentes.length}`);

    if (valoresVigentes.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No hay valores vigentes hasta ${fechaLimiteISO} en el período especificado`
      }, { status: 404 });
    }

    // Agrupar por modelo y plataforma
    // Para cada plataforma, tomar el valor más reciente que esté dentro del límite
    const valoresPorModelo = new Map<string, Map<string, any>>();
    valoresVigentes.forEach(v => {
      if (!valoresPorModelo.has(v.model_id)) {
        valoresPorModelo.set(v.model_id, new Map());
      }
      const porPlataforma = valoresPorModelo.get(v.model_id)!;
      const existente = porPlataforma.get(v.platform_id);
      // Tomar el valor más reciente (ya están ordenados por updated_at DESC)
      if (!existente || new Date(v.updated_at) > new Date(existente.updated_at)) {
        porPlataforma.set(v.platform_id, v);
      }
    });

    console.log(`📦 [EMERGENCY-ARCHIVE] Modelos a procesar: ${valoresPorModelo.size}`);
    
    // Log de modelos que tienen valores pero no pasaron el filtro
    const modelosConValores = new Set(todosLosValores.map(v => v.model_id));
    const modelosFiltrados = new Set(valoresVigentes.map(v => v.model_id));
    const modelosExcluidos = Array.from(modelosConValores).filter(id => !modelosFiltrados.has(id));
    if (modelosExcluidos.length > 0) {
      console.log(`⚠️ [EMERGENCY-ARCHIVE] Modelos con valores pero excluidos por filtro de fecha: ${modelosExcluidos.length}`);
      modelosExcluidos.forEach(modelId => {
        const valoresDelModelo = todosLosValores.filter(v => v.model_id === modelId);
        const maxUpdatedAt = valoresDelModelo.reduce((max, v) => {
          const updatedAt = new Date(v.updated_at);
          return updatedAt > max ? updatedAt : max;
        }, new Date(0));
        console.log(`   - Modelo ${modelId}: máximo updated_at = ${maxUpdatedAt.toISOString()} (límite: ${fechaLimiteISO})`);
      });
    }

    // 4. Obtener emails
    const modelIds = Array.from(valoresPorModelo.keys());
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', modelIds);

    const emailMap = new Map(users?.map(u => [u.id, u.email]) || []);

    // 5. Procesar cada modelo
    const resultados = [];
    let exitosos = 0;
    let errores = 0;

    for (const [modelId, valoresPorPlataforma] of Array.from(valoresPorModelo.entries())) {
      const email = emailMap.get(modelId) || modelId;
      const resultado: any = {
        model_id: modelId,
        email,
        plataformas: valoresPorPlataforma.size,
        archivados: 0,
        eliminados: 0,
        error: null
      };

      try {
        console.log(`\n📦 [ARCHIVE] Procesando modelo: ${email} (${modelId})`);
        console.log(`📦 [ARCHIVE] Plataformas a archivar: ${valoresPorPlataforma.size}`);
        
        // Log de valores que se van a archivar
        console.log(`📦 [ARCHIVE] Valores a archivar:`);
        for (const [platformId, valor] of Array.from(valoresPorPlataforma.entries())) {
          console.log(`   - Plataforma ${platformId}: ${valor.value} (updated_at: ${valor.updated_at}, period_date: ${valor.period_date})`);
        }
        
        // Obtener configuración
        console.log(`📦 [ARCHIVE] Obteniendo configuración...`);
        const { data: config, error: configError } = await supabase
          .from('calculator_config')
          .select('percentage_override, group_percentage')
          .eq('model_id', modelId)
          .eq('active', true)
          .single();

        if (configError && configError.code !== 'PGRST116') {
          console.error(`❌ [ARCHIVE] Error obteniendo config:`, configError);
          throw new Error(`Error obteniendo configuración: ${configError.message}`);
        }

        const modelPercentage = config?.percentage_override || config?.group_percentage || 80;
        console.log(`📦 [ARCHIVE] Porcentaje del modelo: ${modelPercentage}%`);

        // Preparar registros
        console.log(`📦 [ARCHIVE] Preparando registros históricos...`);
        const historyInserts = [];
        for (const [platformId, valor] of Array.from(valoresPorPlataforma.entries())) {
          const platform = platformMap.get(platformId);
          const currency = platform?.currency || 'USD';
          const valueNum = Number(valor.value) || 0;

          if (valueNum <= 0) {
            console.log(`   ⚠️ Saltando plataforma ${platformId}: valor ${valueNum} <= 0`);
            continue;
          }

          const valueUsdBruto = calculateUsdBruto(valueNum, platformId, currency, rates);
          const valueUsdModelo = valueUsdBruto * (modelPercentage / 100);
          const valueCopModelo = valueUsdModelo * rates.usd_cop;

          // Validar que todos los campos requeridos estén presentes
          if (!modelId || !platformId || !startDate || !periodType) {
            console.error(`   ❌ Campos requeridos faltantes: modelId=${modelId}, platformId=${platformId}, startDate=${startDate}, periodType=${periodType}`);
            continue;
          }

          const historyRecord = {
            model_id: modelId,
            platform_id: platformId,
            period_date: startDate,
            period_type: periodType,
            value: parseFloat(valueNum.toFixed(2)),
            rate_eur_usd: rates.eur_usd || null,
            rate_gbp_usd: rates.gbp_usd || null,
            rate_usd_cop: rates.usd_cop || null,
            platform_percentage: modelPercentage,
            value_usd_bruto: parseFloat(valueUsdBruto.toFixed(2)),
            value_usd_modelo: parseFloat(valueUsdModelo.toFixed(2)),
            value_cop_modelo: parseFloat(valueCopModelo.toFixed(2)),
            archived_at: new Date().toISOString(),
            original_updated_at: valor.updated_at || null
          };

          // Validar que los valores numéricos sean válidos
          if (isNaN(historyRecord.value) || isNaN(historyRecord.value_usd_bruto) || 
              isNaN(historyRecord.value_usd_modelo) || isNaN(historyRecord.value_cop_modelo)) {
            console.error(`   ❌ Valores numéricos inválidos para plataforma ${platformId}:`, historyRecord);
            continue;
          }

          historyInserts.push(historyRecord);
        }

        console.log(`📦 [ARCHIVE] Registros preparados: ${historyInserts.length}`);

        if (historyInserts.length === 0) {
          console.error(`❌ [ARCHIVE] No hay valores válidos para ${email}`);
          resultado.error = 'No hay valores válidos';
          errores++;
          resultados.push(resultado);
          continue;
        }

        // Insertar en calculator_history
        // Estrategia: Verificar si existe antes de insertar, si existe actualizar, si no insertar
        console.log(`📦 [ARCHIVE] Insertando ${historyInserts.length} registros en calculator_history...`);
        
        let insertedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        for (const record of historyInserts) {
          try {
            // Verificar si ya existe
            const { data: existing, error: checkError } = await supabase
              .from('calculator_history')
              .select('id')
              .eq('model_id', record.model_id)
              .eq('platform_id', record.platform_id)
              .eq('period_date', record.period_date)
              .eq('period_type', record.period_type)
              .single();

            if (checkError && checkError.code !== 'PGRST116') {
              // Error que no sea "no encontrado"
              console.error(`   ⚠️ Error verificando existencia:`, checkError);
              errorCount++;
              continue;
            }

            if (existing) {
              // Actualizar registro existente
              const { error: updateError } = await supabase
                .from('calculator_history')
                .update({
                  value: record.value,
                  rate_eur_usd: record.rate_eur_usd,
                  rate_gbp_usd: record.rate_gbp_usd,
                  rate_usd_cop: record.rate_usd_cop,
                  platform_percentage: record.platform_percentage,
                  value_usd_bruto: record.value_usd_bruto,
                  value_usd_modelo: record.value_usd_modelo,
                  value_cop_modelo: record.value_cop_modelo,
                  archived_at: record.archived_at,
                  original_updated_at: record.original_updated_at
                })
                .eq('id', existing.id);

              if (updateError) {
                console.error(`   ❌ Error actualizando registro:`, updateError);
                errorCount++;
              } else {
                updatedCount++;
              }
            } else {
              // Insertar nuevo registro
              const { error: insertError } = await supabase
                .from('calculator_history')
                .insert(record);

              if (insertError) {
                console.error(`   ❌ Error insertando registro:`, insertError);
                errorCount++;
              } else {
                insertedCount++;
              }
            }
          } catch (err: any) {
            console.error(`   ❌ Error procesando registro:`, err);
            errorCount++;
          }
        }

        console.log(`📦 [ARCHIVE] Resultado: ${insertedCount} insertados, ${updatedCount} actualizados, ${errorCount} errores`);

        if (errorCount > 0 && insertedCount === 0 && updatedCount === 0) {
          throw new Error(`Error insertando registros: ${errorCount} errores de ${historyInserts.length} intentos`);
        }

        // VALIDACIÓN: Verificar inserción
        console.log(`📦 [ARCHIVE] Verificando inserción...`);
        const { data: verificationData, error: verificationError } = await supabase
          .from('calculator_history')
          .select('id, platform_id')
          .eq('model_id', modelId)
          .eq('period_date', startDate)
          .eq('period_type', periodType);

        if (verificationError) {
          console.error(`❌ [ARCHIVE] Error verificando inserción:`, verificationError);
          throw new Error(`Error verificando: ${verificationError.message}`);
        }

        const verifiedCount = verificationData?.length || 0;
        const totalProcessed = insertedCount + updatedCount;
        console.log(`📦 [ARCHIVE] Verificados: ${verifiedCount} de ${historyInserts.length} esperados`);
        console.log(`📦 [ARCHIVE] Procesados: ${totalProcessed} (${insertedCount} insertados, ${updatedCount} actualizados)`);
        
        // Si hubo errores pero al menos algunos se procesaron, continuar
        if (errorCount > 0 && totalProcessed === 0) {
          const errorMsg = `Error procesando registros: ${errorCount} errores de ${historyInserts.length} intentos`;
          console.error(`❌ [ARCHIVE] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        // Si la verificación muestra menos registros de los esperados, pero algunos se procesaron, continuar
        if (verifiedCount < historyInserts.length && totalProcessed > 0) {
          console.warn(`⚠️ [ARCHIVE] Se procesaron ${totalProcessed} pero se verificaron ${verifiedCount}. Continuando...`);
        }

        // NO ELIMINAR valores de model_values - Solo archivar
        // IMPORTANTE: Este endpoint SOLO archiva, NO elimina valores
        // Los valores se mantienen en model_values para verificación
        resultado.archivados = verifiedCount;
        resultado.eliminados = 0; // No se eliminan valores
        resultado.insertados = insertedCount;
        resultado.actualizados = updatedCount;
        resultado.errores_procesamiento = errorCount;
        exitosos++;
        resultados.push(resultado);
        console.log(`✅ [ARCHIVE] Modelo ${email} archivado exitosamente: ${verifiedCount} registros verificados`);

      } catch (error: any) {
        const errorMsg = error.message || 'Error desconocido';
        console.error(`❌ [ARCHIVE] Error procesando ${email}:`, errorMsg);
        console.error(`❌ [ARCHIVE] Stack trace:`, error.stack);
        resultado.error = errorMsg;
        resultado.detalle_error = error.stack || error.toString();
        errores++;
        resultados.push(resultado);
      }
    }

    // Verificación final
    // Reutilizar fechaLimite y fechaLimiteISO ya declaradas arriba
    
    // Verificar que los valores aún están en model_values (no se eliminaron)
    const { data: valoresEnModelValues } = await supabase
      .from('model_values')
      .select('model_id')
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .lte('updated_at', fechaLimiteISO);

    const { data: archivoFinal } = await supabase
      .from('calculator_history')
      .select('model_id, platform_id')
      .eq('period_date', startDate)
      .eq('period_type', periodType);

    const totalArchivados = resultados.filter(r => !r.error).reduce((sum, r) => sum + r.archivados, 0);

    return NextResponse.json({
      success: true,
      mensaje: 'Valores archivados correctamente. Los valores se mantienen en model_values para verificación.',
      resumen: {
        total_modelos: resultados.length,
        exitosos,
        errores,
        total_archivados: totalArchivados,
        valores_en_model_values: valoresEnModelValues?.length || 0,
        registros_en_history: archivoFinal?.length || 0,
        nota: 'Los valores NO fueron eliminados de model_values. Puedes verificar el archivado antes de eliminarlos.'
      },
      resultados: resultados
    });

  } catch (error: any) {
    console.error('❌ [EMERGENCY-ARCHIVE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error desconocido'
    }, { status: 500 });
  }
}

