/**
 * 🔧 API DE EDICIÓN PARA ADMINS - HISTORIAL DE CALCULADORA
 * Permite a admins y super_admins editar valores y tasas en períodos archivados
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const dynamic = 'force-dynamic';

/**
 * PUT: Actualizar valor de plataforma en un período archivado
 * POST: Actualizar tasas de un período archivado
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      historyId,
      period_date,
      period_type,
      model_id,
      platform_id,
      value,
      value_usd_bruto,
      value_usd_modelo,
      value_cop_modelo
    } = body;

    // Aceptar historyId o combinación de period_date, period_type, model_id, platform_id
    if (!historyId && (!period_date || !period_type || !model_id || !platform_id)) {
      return NextResponse.json({
        success: false,
        error: 'historyId o (period_date, period_type, model_id, platform_id) son requeridos'
      }, { status: 400 });
    }

    // 🔒 VERIFICAR AUTENTICACIÓN Y PERMISOS
    const authHeader = request.headers.get('authorization');
    let authenticatedUserId: string | null = null;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (token) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          authenticatedUserId = user.id;
        }
      } catch (error) {
        console.warn('⚠️ [CALCULATOR-HISTORIAL-UPDATE] Error verificando autenticación:', error);
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

    if (!isAdmin) {
      console.warn(`🚫 [CALCULATOR-HISTORIAL-UPDATE] Usuario ${authenticatedUserId} sin permisos de edición`);
      return NextResponse.json({
        success: false,
        error: 'No autorizado: Solo admins pueden editar historial'
      }, { status: 403 });
    }

    // Verificar que el registro existe
    let query = supabase.from('calculator_history').select('*');
    
    if (historyId) {
      query = query.eq('id', historyId);
    } else {
      query = query
        .eq('period_date', period_date)
        .eq('period_type', period_type)
        .eq('model_id', model_id)
        .eq('platform_id', platform_id);
    }

    const { data: existingRecords, error: fetchError } = await query;

    if (fetchError || !existingRecords || existingRecords.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Registro no encontrado'
      }, { status: 404 });
    }

    // Si hay múltiples registros (poco probable pero posible), tomar el primero
    const existingRecord = existingRecords[0];
    const targetHistoryId = historyId || existingRecord.id;

    // Preparar campos a actualizar
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (value !== undefined) {
      updateData.value = Number(value);
    }

    if (value_usd_bruto !== undefined) {
      updateData.value_usd_bruto = Number(value_usd_bruto);
    }

    if (value_usd_modelo !== undefined) {
      updateData.value_usd_modelo = Number(value_usd_modelo);
    }

    if (value_cop_modelo !== undefined) {
      updateData.value_cop_modelo = Number(value_cop_modelo);
    }

    // Actualizar registro
    const { data: updatedRecord, error: updateError } = await supabase
      .from('calculator_history')
      .update(updateData)
      .eq('id', targetHistoryId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error actualizando:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Error al actualizar registro'
      }, { status: 500 });
    }

    console.log(`✅ [CALCULATOR-HISTORIAL-UPDATE] Registro ${targetHistoryId} actualizado por admin ${authenticatedUserId}`);

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: 'Registro actualizado exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

/**
 * POST: Actualizar tasas de un período completo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      period_date,
      period_type,
      model_id,
      rates
    } = body;

    if (!period_date || !period_type || !model_id || !rates) {
      return NextResponse.json({
        success: false,
        error: 'period_date, period_type, model_id y rates son requeridos'
      }, { status: 400 });
    }

    // 🔒 VERIFICAR AUTENTICACIÓN Y PERMISOS (igual que PUT)
    const authHeader = request.headers.get('authorization');
    let authenticatedUserId: string | null = null;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (token) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          authenticatedUserId = user.id;
        }
      } catch (error) {
        console.warn('⚠️ [CALCULATOR-HISTORIAL-UPDATE] Error verificando autenticación:', error);
      }
    }

    if (!authenticatedUserId) {
      return NextResponse.json({
        success: false,
        error: 'Autenticación requerida'
      }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', authenticatedUserId)
      .single();

    const userRole = userData?.role || 'modelo';
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado: Solo admins pueden editar tasas'
      }, { status: 403 });
    }

    // Actualizar tasas en todos los registros del período
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (rates.eur_usd !== undefined) {
      updateData.rate_eur_usd = Number(rates.eur_usd);
    }
    if (rates.gbp_usd !== undefined) {
      updateData.rate_gbp_usd = Number(rates.gbp_usd);
    }
    if (rates.usd_cop !== undefined) {
      updateData.rate_usd_cop = Number(rates.usd_cop);
    }

    // Recalcular valores si se actualizan las tasas
    // NOTA: Esto requiere recalcular todos los valores del período
    // Por ahora, solo actualizamos las tasas. Los cálculos se pueden hacer manualmente o en una segunda llamada

    const { data: updatedRecords, error: updateError } = await supabase
      .from('calculator_history')
      .update(updateData)
      .eq('model_id', model_id)
      .eq('period_date', period_date)
      .eq('period_type', period_type)
      .select();

    if (updateError) {
      console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error actualizando tasas:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Error al actualizar tasas'
      }, { status: 500 });
    }

    console.log(`✅ [CALCULATOR-HISTORIAL-UPDATE] ${updatedRecords?.length || 0} registros actualizados con nuevas tasas`);

    return NextResponse.json({
      success: true,
      updated_count: updatedRecords?.length || 0,
      message: 'Tasas actualizadas exitosamente. Nota: Los valores calculados (USD bruto, USD modelo, COP) no se recalcularon automáticamente.'
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

