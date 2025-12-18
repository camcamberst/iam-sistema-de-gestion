/**
 * 🔧 API PARA EDITAR TASAS GLOBALES DE CIERRE POR PERÍODO
 * Permite a admins y super_admins editar las tasas de cierre de un período específico
 * Afecta TODAS las modelos del período seleccionado
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const dynamic = 'force-dynamic';

/**
 * GET: Obtener información del período y conteo de registros
 * POST: Actualizar tasas globales del período y recalcular todos los valores
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period_date = searchParams.get('period_date');
    const period_type = searchParams.get('period_type'); // '1-15' o '16-31'

    if (!period_date || !period_type) {
      return NextResponse.json({
        success: false,
        error: 'period_date y period_type son requeridos'
      }, { status: 400 });
    }

    // 🔒 VERIFICAR AUTENTICACIÓN Y PERMISOS
    const authHeader = request.headers.get('authorization');
    let authenticatedUserId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          authenticatedUserId = user.id;
        }
      } catch (error) {
        console.warn('⚠️ [PERIOD-RATES-UPDATE] Error verificando autenticación:', error);
      }
    }

    if (!authenticatedUserId) {
      return NextResponse.json({
        success: false,
        error: 'Autenticación requerida'
      }, { status: 401 });
    }

    // Verificar rol del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', authenticatedUserId)
      .single();

    const userRole = userData?.role || 'modelo';
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    const isSuperAdmin = userRole === 'super_admin';
    const isGestor = userRole === 'gestor';

    // Permitir admins, super_admins y gestores
    if (!isAdmin && !isGestor) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado: Solo admins, super_admins y gestores pueden consultar información de períodos'
      }, { status: 403 });
    }

    // Obtener grupos del usuario si no es super_admin ni gestor
    // Los gestores tienen acceso a TODOS los grupos (como super_admins)
    let allowedGroupIds: string[] = [];
    if (!isSuperAdmin && !isGestor) {
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', authenticatedUserId);
      allowedGroupIds = (userGroups || []).map((ag: any) => ag.group_id);
    }

    // Contar registros del período CERRADO (archivado)
    let countQuery = supabase
      .from('calculator_history')
      .select('*', { count: 'exact', head: true })
      .eq('period_date', period_date)
      .eq('period_type', period_type)
      .not('archived_at', 'is', null); // Solo períodos archivados

    // Si no es super_admin ni gestor, filtrar por grupos del usuario (solo admins)
    // Los gestores tienen acceso a TODOS los grupos (como super_admins)
    if (!isSuperAdmin && !isGestor && allowedGroupIds.length > 0) {
      const { data: modelGroups } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', allowedGroupIds);
      
      const allowedModelIds = (modelGroups || []).map((mg: any) => mg.user_id);
      if (allowedModelIds.length > 0) {
        countQuery = countQuery.in('model_id', allowedModelIds);
      } else {
        // No hay modelos en los grupos del usuario
        return NextResponse.json({
          success: true,
          period_date,
          period_type,
          records_count: 0,
          current_rates: { eur_usd: null, gbp_usd: null, usd_cop: null }
        });
      }
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('❌ [PERIOD-RATES-UPDATE] Error contando registros:', countError);
      return NextResponse.json({
        success: false,
        error: 'Error al obtener información del período'
      }, { status: 500 });
    }

    // Obtener una muestra de registros para obtener las tasas actuales (solo archivados)
    let sampleQuery = supabase
      .from('calculator_history')
      .select('rate_eur_usd, rate_gbp_usd, rate_usd_cop')
      .eq('period_date', period_date)
      .eq('period_type', period_type)
      .not('archived_at', 'is', null)
      .limit(1);

    // Si no es super_admin ni gestor, filtrar por grupos del usuario (solo admins)
    // Los gestores tienen acceso a TODOS los grupos (como super_admins)
    if (!isSuperAdmin && !isGestor && allowedGroupIds.length > 0) {
      const { data: modelGroups } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', allowedGroupIds);
      
      const allowedModelIds = (modelGroups || []).map((mg: any) => mg.user_id);
      if (allowedModelIds.length > 0) {
        sampleQuery = sampleQuery.in('model_id', allowedModelIds);
      }
    }

    const { data: sampleRecords, error: sampleError } = await sampleQuery.single();

    if (sampleError && sampleError.code !== 'PGRST116') {
      console.error('❌ [PERIOD-RATES-UPDATE] Error obteniendo muestra:', sampleError);
    }

    return NextResponse.json({
      success: true,
      period_date,
      period_type,
      records_count: count || 0,
      current_rates: {
        eur_usd: sampleRecords?.rate_eur_usd || null,
        gbp_usd: sampleRecords?.rate_gbp_usd || null,
        usd_cop: sampleRecords?.rate_usd_cop || null
      }
    });

  } catch (error: any) {
    console.error('❌ [PERIOD-RATES-UPDATE] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

/**
 * POST: Actualizar tasas globales del período para TODAS las modelos
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
      const {
      period_date,
      period_type,
      rates,
      admin_id,
      admin_name,
      group_id // Opcional: para gestores que quieren filtrar por grupo específico
    } = body;

    if (!period_date || !period_type || !rates) {
      return NextResponse.json({
        success: false,
        error: 'period_date, period_type y rates son requeridos'
      }, { status: 400 });
    }

    // 🔒 VERIFICAR AUTENTICACIÓN Y PERMISOS
    const authHeader = request.headers.get('authorization');
    let authenticatedUserId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          authenticatedUserId = user.id;
        }
      } catch (error) {
        console.warn('⚠️ [PERIOD-RATES-UPDATE] Error verificando autenticación:', error);
      }
    }

    if (!authenticatedUserId) {
      return NextResponse.json({
        success: false,
        error: 'Autenticación requerida'
      }, { status: 401 });
    }

    // Verificar rol del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('role, name, email')
      .eq('id', authenticatedUserId)
      .single();

    const userRole = userData?.role || 'modelo';
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    const isSuperAdmin = userRole === 'super_admin';
    const isGestor = userRole === 'gestor';

    // Permitir admins, super_admins y gestores
    if (!isAdmin && !isGestor) {
      console.warn(`🚫 [PERIOD-RATES-UPDATE] Usuario ${authenticatedUserId} sin permisos de edición`);
      return NextResponse.json({
        success: false,
        error: 'No autorizado: Solo admins, super_admins y gestores pueden editar tasas históricas'
      }, { status: 403 });
    }

    // Obtener grupos del usuario si no es super_admin ni gestor
    // Los gestores tienen acceso a TODOS los grupos (como super_admins)
    let allowedGroupIds: string[] = [];
    if (!isSuperAdmin && !isGestor) {
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', authenticatedUserId);
      allowedGroupIds = (userGroups || []).map((ag: any) => ag.group_id);
      
      if (allowedGroupIds.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No tienes grupos asignados. Contacta al administrador.'
        }, { status: 403 });
      }
    }

    // Preparar las nuevas tasas
    const newRates = {
      eur_usd: rates.eur_usd !== undefined ? Number(rates.eur_usd) : null,
      gbp_usd: rates.gbp_usd !== undefined ? Number(rates.gbp_usd) : null,
      usd_cop: rates.usd_cop !== undefined ? Number(rates.usd_cop) : null
    };

    // Validar que todas las tasas estén presentes
    if (newRates.eur_usd === null || newRates.gbp_usd === null || newRates.usd_cop === null) {
      return NextResponse.json({
        success: false,
        error: 'Todas las tasas (eur_usd, gbp_usd, usd_cop) son requeridas'
      }, { status: 400 });
    }

    // TypeScript: después de la validación, sabemos que no son null
    const validatedRates = {
      eur_usd: newRates.eur_usd as number,
      gbp_usd: newRates.gbp_usd as number,
      usd_cop: newRates.usd_cop as number
    };

    // 🔒 IMPORTANTE: Solo afectar períodos CERRADOS
    // Verificar que el período esté cerrado (marcado como completed o sin datos en model_values)
    console.log(`🔍 [PERIOD-RATES-UPDATE] Buscando registros para período: ${period_date} (${period_type})`);
    console.log(`🔍 [PERIOD-RATES-UPDATE] Usuario: ${authenticatedUserId}, Rol: ${userRole}, SuperAdmin: ${isSuperAdmin}`);
    
    // Verificar estado de cierre del período
    const { data: closureStatus } = await supabase
      .from('calculator_period_closure_status')
      .select('status, completed_at')
      .eq('period_date', period_date)
      .eq('period_type', period_type)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const isPeriodClosed = closureStatus?.status === 'completed' || 
                          (closureStatus?.status && ['closing_calculators', 'waiting_summary', 'closing_summary', 'archiving'].includes(closureStatus.status));
    
    // Verificar si hay datos en model_values (si no hay, el período fue reseteado)
    const periodStartDate = period_date;
    const periodEndDate = period_type === '1-15' 
      ? `${period_date.split('-')[0]}-${period_date.split('-')[1]}-15`
      : `${period_date.split('-')[0]}-${period_date.split('-')[1]}-31`;
    
    const { count: modelValuesCount } = await supabase
      .from('model_values')
      .select('*', { count: 'exact', head: true })
      .gte('period_date', periodStartDate)
      .lte('period_date', periodEndDate);
    
    const periodWasReset = (modelValuesCount || 0) === 0;
    
    // Si el período no está cerrado Y hay datos en model_values, no permitir editar
    if (!isPeriodClosed && !periodWasReset) {
      return NextResponse.json({
        success: false,
        error: `El período ${period_date} (${period_type}) no está cerrado. Solo se pueden editar tasas de períodos cerrados.`
      }, { status: 400 });
    }
    
    // Si el período está cerrado o fue reseteado, permitir editar rates (aunque no haya registros archivados)
    if (!isPeriodClosed && !periodWasReset) {
      return NextResponse.json({
        success: false,
        error: `El período ${period_date} (${period_type}) no está cerrado. Solo se pueden editar tasas de períodos cerrados.`
      }, { status: 400 });
    }
    
    let periodRecordsQuery = supabase
      .from('calculator_history')
      .select('*, model_id, archived_at')
      .eq('period_date', period_date)
      .eq('period_type', period_type)
      .not('archived_at', 'is', null); // Solo períodos archivados (cerrados)

    // Si no es super_admin ni gestor, filtrar por grupos del usuario (solo admins)
    // Los gestores tienen acceso a TODOS los grupos (como super_admins)
    if (!isSuperAdmin && !isGestor && allowedGroupIds.length > 0) {
      console.log(`🔍 [PERIOD-RATES-UPDATE] Usuario (${userRole}) con grupos asignados: ${allowedGroupIds.length} grupos`);
      
      // Si se especifica group_id, validar que el usuario tenga acceso a ese grupo
      let finalGroupIds = allowedGroupIds;
      if (group_id) {
        if (!allowedGroupIds.includes(group_id)) {
          return NextResponse.json({
            success: false,
            error: 'No tienes acceso al grupo especificado'
          }, { status: 403 });
        }
        finalGroupIds = [group_id]; // Filtrar solo por el grupo especificado
      }
      
      // Obtener IDs de modelos que pertenecen a los grupos del usuario
      const { data: modelGroups, error: modelGroupsError } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', finalGroupIds);
      
      if (modelGroupsError) {
        console.error('❌ [PERIOD-RATES-UPDATE] Error obteniendo modelos de grupos:', modelGroupsError);
      }
      
      const allowedModelIds = (modelGroups || []).map((mg: any) => mg.user_id);
      console.log(`🔍 [PERIOD-RATES-UPDATE] Modelos en grupos del usuario: ${allowedModelIds.length}`);
      
      if (allowedModelIds.length === 0) {
        console.warn(`⚠️ [PERIOD-RATES-UPDATE] No hay modelos en los grupos del usuario (${userRole})`);
        return NextResponse.json({
          success: false,
          error: 'No hay modelos en tus grupos asignados'
        }, { status: 404 });
      }
      
      periodRecordsQuery = periodRecordsQuery.in('model_id', allowedModelIds);
    } else if (!isSuperAdmin && !isGestor) {
      console.warn(`⚠️ [PERIOD-RATES-UPDATE] Usuario (${userRole}) sin grupos asignados`);
    } else {
      // SuperAdmin o Gestor: buscar todos los registros, pero si se especifica group_id, filtrar por ese grupo
      if (group_id) {
        console.log(`🔍 [PERIOD-RATES-UPDATE] ${isGestor ? 'Gestor' : 'SuperAdmin'}: filtrando por grupo específico: ${group_id}`);
        const { data: modelGroups } = await supabase
          .from('user_groups')
          .select('user_id')
          .eq('group_id', group_id);
        
        const allowedModelIds = (modelGroups || []).map((mg: any) => mg.user_id);
        if (allowedModelIds.length > 0) {
          periodRecordsQuery = periodRecordsQuery.in('model_id', allowedModelIds);
        } else {
          return NextResponse.json({
            success: false,
            error: 'No hay modelos en el grupo especificado'
          }, { status: 404 });
        }
      } else {
        console.log(`🔍 [PERIOD-RATES-UPDATE] ${isGestor ? 'Gestor' : 'SuperAdmin'}: buscando todos los registros sin filtrar por grupos`);
      }
    }

    const { data: periodRecords, error: fetchError } = await periodRecordsQuery;
    
    console.log(`🔍 [PERIOD-RATES-UPDATE] Query ejecutada. Registros encontrados: ${periodRecords?.length || 0}`);
    if (fetchError) {
      console.error('❌ [PERIOD-RATES-UPDATE] Error en la consulta:', fetchError);
    }

    if (fetchError) {
      console.error('❌ [PERIOD-RATES-UPDATE] Error obteniendo registros:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Error al obtener registros del período'
      }, { status: 500 });
    }

    if (!periodRecords || periodRecords.length === 0) {
      // Debug: Intentar buscar sin el filtro de archived_at para diagnosticar
      let debugQuery = supabase
        .from('calculator_history')
        .select('id, period_date, period_type, archived_at, model_id')
        .eq('period_type', period_type);
      
      // Si no es super_admin ni gestor, filtrar por grupos
      if (!isSuperAdmin && !isGestor && allowedGroupIds.length > 0) {
        const { data: modelGroups } = await supabase
          .from('user_groups')
          .select('user_id')
          .in('group_id', allowedGroupIds);
        const allowedModelIds = (modelGroups || []).map((mg: any) => mg.user_id);
        if (allowedModelIds.length > 0) {
          debugQuery = debugQuery.in('model_id', allowedModelIds);
        }
      }
      
      // Buscar con period_date exacto
      const { data: debugRecords, error: debugError } = await debugQuery
        .eq('period_date', period_date)
        .limit(10);
      
      // También buscar registros del mismo mes (por si period_date es diferente)
      const [year, month] = period_date.split('-');
      const { data: monthRecords } = await supabase
        .from('calculator_history')
        .select('period_date, period_type, archived_at, COUNT(*)')
        .eq('period_type', period_type)
        .gte('period_date', `${year}-${month}-01`)
        .lte('period_date', `${year}-${month}-31`)
        .limit(10);
      
      console.log(`🔍 [PERIOD-RATES-UPDATE] DEBUG - Registros encontrados:`, {
        period_date_exact: debugRecords?.length || 0,
        period_date_sample: debugRecords?.slice(0, 3),
        month_records: monthRecords?.length || 0,
        month_sample: monthRecords?.slice(0, 3),
        error: debugError
      });
      
      // Si hay registros sin archived_at, sugerir que el período no se cerró correctamente
      const recordsWithoutArchived = debugRecords?.filter((r: any) => !r.archived_at) || [];
      if (recordsWithoutArchived.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Se encontraron ${debugRecords?.length || 0} registros para el período ${period_date} (${period_type}), pero ${recordsWithoutArchived.length} no tienen 'archived_at'. El período puede no haberse cerrado correctamente. Contacta al administrador.`
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: false,
        error: `No se encontraron registros CERRADOS (archivados) para el período ${period_date} (${period_type}). Solo se pueden editar tasas de períodos que ya fueron cerrados. Total encontrado sin filtro: ${debugRecords?.length || 0}`
      }, { status: 404 });
    }

    // Verificar que al menos un registro tenga archived_at (período cerrado)
    const hasArchivedRecords = periodRecords.some((r: any) => r.archived_at);
    if (!hasArchivedRecords) {
      return NextResponse.json({
        success: false,
        error: 'Este período no está cerrado. Solo se pueden editar tasas de períodos archivados.'
      }, { status: 400 });
    }

    console.log(`📊 [PERIOD-RATES-UPDATE] Actualizando ${periodRecords.length} registros del período ${period_date} (${period_type})`);

    // Obtener información de plataformas (currency)
    const platformIds = Array.from(new Set(periodRecords.map((r: any) => r.platform_id).filter(Boolean)));
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, currency')
      .eq('active', true)
      .in('id', platformIds);

    if (platformsError) {
      console.error('❌ [PERIOD-RATES-UPDATE] Error obteniendo plataformas:', platformsError);
      return NextResponse.json({
        success: false,
        error: 'Error al obtener información de plataformas'
      }, { status: 500 });
    }

    const platformMap = new Map((platforms || []).map((p: any) => [p.id, p]));

    // Función helper para calcular USD bruto (misma lógica que en period-closure-helpers)
    const calculateUsdBruto = (value: number, platformId: string, currency: string, rates: { eur_usd: number; gbp_usd: number; usd_cop: number }): number => {
      if (currency === 'EUR') {
        if (platformId === 'big7') {
          return (value * rates.eur_usd) * 0.84; // 16% impuesto
        } else if (platformId === 'mondo') {
          return (value * rates.eur_usd) * 0.78; // 22% descuento
        } else {
          return value * rates.eur_usd;
        }
      } else if (currency === 'GBP') {
        if (platformId === 'aw') {
          return (value * rates.gbp_usd) * 0.677; // 32.3% descuento
        } else {
          return value * rates.gbp_usd;
        }
      } else if (currency === 'USD') {
        if (platformId === 'cmd' || platformId === 'camlust' || platformId === 'skypvt') {
          return value * 0.75; // 25% descuento
        } else if (platformId === 'chaturbate' || platformId === 'myfreecams' || platformId === 'stripchat') {
          return value * 0.05; // 100 tokens = 5 USD
        } else if (platformId === 'dxlive') {
          return value * 0.60; // 100 pts = 60 USD
        } else if (platformId === 'secretfriends') {
          return value * 0.5; // 50% descuento
        } else if (platformId === 'superfoon') {
          return value; // 100% directo
        } else {
          return value;
        }
      }
      return 0;
    };

    // Recalcular todos los valores derivados para cada registro
    const updates = periodRecords.map((record: any) => {
      const platform = platformMap.get(record.platform_id);
      const currency = platform?.currency || 'USD';
      const originalValue = Number(record.value) || 0;
      
      // Obtener porcentaje (usar el guardado o un valor por defecto)
      const platformPercentage = record.platform_percentage || 80;
      
      // Recalcular USD bruto con las nuevas tasas
      const valueUsdBruto = calculateUsdBruto(originalValue, record.platform_id, currency, validatedRates);
      
      // Recalcular USD modelo
      const valueUsdModelo = valueUsdBruto * (platformPercentage / 100);
      
      // Recalcular COP modelo
      const valueCopModelo = valueUsdModelo * validatedRates.usd_cop;

      return {
        id: record.id,
        rate_eur_usd: validatedRates.eur_usd,
        rate_gbp_usd: validatedRates.gbp_usd,
        rate_usd_cop: validatedRates.usd_cop,
        value_usd_bruto: parseFloat(valueUsdBruto.toFixed(2)),
        value_usd_modelo: parseFloat(valueUsdModelo.toFixed(2)),
        value_cop_modelo: parseFloat(valueCopModelo.toFixed(2))
        // No incluimos updated_at - la tabla calculator_history no tiene esta columna
      };
    });

    // Actualizar todos los registros usando batch updates (más eficiente y confiable)
    let updatedCount = 0;
    const errors: string[] = [];
    
    console.log(`🔄 [PERIOD-RATES-UPDATE] Preparando actualizar ${updates.length} registros...`);
    
    // Actualizar en lotes de 50 para mejor rendimiento y evitar timeouts
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      console.log(`🔄 [PERIOD-RATES-UPDATE] Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(updates.length / batchSize)} (${batch.length} registros)`);
      
      // Actualizar en paralelo dentro del lote
      const batchPromises = batch.map(async (update) => {
        // IMPORTANTE: El supabase client ya está configurado con SERVICE_ROLE_KEY
        // que debería bypass RLS automáticamente. Si aún falla, puede ser por:
        // 1. Políticas RLS con USING (false) que bloquean incluso a service_role
        // 2. La clave de servicio no está correctamente configurada
        // 3. Problemas de permisos a nivel de base de datos
        
        // Actualizar registro y verificar que se actualizó correctamente
        // NOTA: No incluimos updated_at porque esta columna no existe en calculator_history
        const { data: updatedData, error: updateError } = await supabase
          .from('calculator_history')
          .update({
            rate_eur_usd: update.rate_eur_usd,
            rate_gbp_usd: update.rate_gbp_usd,
            rate_usd_cop: update.rate_usd_cop,
            value_usd_bruto: update.value_usd_bruto,
            value_usd_modelo: update.value_usd_modelo,
            value_cop_modelo: update.value_cop_modelo
            // No incluimos updated_at - la tabla calculator_history no tiene esta columna
          })
          .eq('id', update.id)
          .select('id')
          .single();

        if (updateError) {
          console.error(`❌ [PERIOD-RATES-UPDATE] Error actualizando registro ${update.id}:`, {
            error: updateError,
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint
          });
          errors.push(`Registro ${update.id}: ${updateError.message || 'Error desconocido'}`);
          return false;
        }
        
        // Verificar que realmente se actualizó (si no hay data, el registro no existe o no se pudo actualizar)
        if (!updatedData || !updatedData.id) {
          console.warn(`⚠️ [PERIOD-RATES-UPDATE] Registro ${update.id} no se actualizó. Posible problema de RLS o registro no encontrado.`);
          errors.push(`Registro ${update.id}: No se encontró para actualizar o bloqueado por RLS`);
          return false;
        }
        
        return true;
      });

      const batchResults = await Promise.all(batchPromises);
      const batchSuccessCount = batchResults.filter(r => r === true).length;
      updatedCount += batchSuccessCount;
      
      console.log(`✅ [PERIOD-RATES-UPDATE] Lote completado: ${batchSuccessCount}/${batch.length} actualizados exitosamente`);
    }
    
    console.log(`📊 [PERIOD-RATES-UPDATE] Resumen: ${updatedCount}/${updates.length} registros actualizados exitosamente`);

    // 📝 AUDITORÍA: Guardar registro de quién editó las tasas
    const auditLog = {
      action: 'update_period_rates',
      period_date,
      period_type,
      admin_id: authenticatedUserId,
      admin_name: userData?.name || userData?.email || 'Desconocido',
      rates_before: {
        eur_usd: periodRecords[0]?.rate_eur_usd || null,
        gbp_usd: periodRecords[0]?.rate_gbp_usd || null,
        usd_cop: periodRecords[0]?.rate_usd_cop || null
      },
      rates_after: validatedRates,
      records_affected: updatedCount,
      updated_at: new Date().toISOString()
    };

    // Guardar auditoría en una tabla (si existe) o en logs
    // Por ahora lo guardamos en console, después podemos crear tabla de auditoría
    console.log('📝 [PERIOD-RATES-AUDIT]', JSON.stringify(auditLog, null, 2));

    if (errors.length > 0) {
      console.warn(`⚠️ [PERIOD-RATES-UPDATE] ${errors.length} errores durante la actualización`);
    }

    console.log(`✅ [PERIOD-RATES-UPDATE] ${updatedCount} de ${updates.length} registros actualizados con nuevas tasas`);

    return NextResponse.json({
      success: true,
      updated_count: updatedCount,
      total_records: periodRecords.length,
      errors: errors.length > 0 ? errors : undefined,
      audit_log: auditLog,
      message: `Tasas actualizadas exitosamente para ${updatedCount} registros del período ${period_date} (${period_type}).`
    });

  } catch (error: any) {
    console.error('❌ [PERIOD-RATES-UPDATE] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

