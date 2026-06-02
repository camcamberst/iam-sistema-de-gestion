/**
 * 🔧 API DE EDICIÓN PARA ADMINS - HISTORIAL DE CALCULADORA
 * Permite a admins y super_admins editar valores, tasas y agregar plataformas en períodos archivados.
 * Los cambios se guardan en calculator_history y se reflejan en el Resumen de Facturación de Consulta Histórica.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const dynamic = 'force-dynamic';

/**
 * PUT: Actualizar o insertar valor de plataforma en un período archivado
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
    const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'superadmin_aff';

    if (!isAdmin) {
      console.warn(`🚫 [CALCULATOR-HISTORIAL-UPDATE] Usuario ${authenticatedUserId} sin permisos de edición`);
      return NextResponse.json({
        success: false,
        error: 'No autorizado: Solo admins pueden editar historial'
      }, { status: 403 });
    }

    // Normalizar period_date a YYYY-MM-DD para coincidir con el tipo DATE en BD
    const periodDateNorm = period_date
      ? (typeof period_date === 'string' ? period_date.slice(0, 10) : String(period_date).slice(0, 10))
      : '';

    // Verificar que el registro existe
    let query = supabase.from('calculator_history').select('*');
    
    if (historyId) {
      query = query.eq('id', historyId);
    } else {
      query = query
        .eq('period_date', periodDateNorm || period_date)
        .eq('period_type', period_type)
        .eq('model_id', model_id)
        .eq('platform_id', platform_id);
    }

    const { data: existingRecords, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }

    // SI NO EXISTE: Habilitar adición (INSERT) de plataforma sobre planilla cerrada existente
    if (!existingRecords || existingRecords.length === 0) {
      if (value === undefined || !model_id || !platform_id || !period_type || !periodDateNorm) {
        return NextResponse.json({
          success: false,
          error: 'Registro no encontrado. Se requiere model_id, platform_id, period_date, period_type y value para agregarlo.'
        }, { status: 404 });
      }

      const num = Number(value);
      if (Number.isNaN(num)) {
        return NextResponse.json({ success: false, error: 'El valor debe ser un número válido' }, { status: 400 });
      }

      // 1. Obtener tasas de algún otro registro existente en este período
      const { data: siblingRecords } = await supabase
        .from('calculator_history')
        .select('rate_eur_usd, rate_gbp_usd, rate_usd_cop')
        .eq('model_id', model_id)
        .eq('period_date', periodDateNorm)
        .eq('period_type', period_type)
        .neq('platform_id', '__CONSOLIDATED_TOTAL__')
        .limit(1);

      let rates = { eur_usd: 1.01, gbp_usd: 1.20, usd_cop: 3900 };
      if (siblingRecords && siblingRecords.length > 0) {
        rates = {
          eur_usd: siblingRecords[0].rate_eur_usd || 1.01,
          gbp_usd: siblingRecords[0].rate_gbp_usd || 1.20,
          usd_cop: siblingRecords[0].rate_usd_cop || 3900
        };
      } else {
        const { data: activeRates } = await supabase
          .from('rates')
          .select('kind, value')
          .eq('active', true)
          .is('valid_to', null);
        if (activeRates) {
          rates = {
            eur_usd: activeRates.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
            gbp_usd: activeRates.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20,
            usd_cop: activeRates.find((r: any) => r.kind === 'USD→COP')?.value || 3900
          };
        }
      }

      // 2. Obtener divisa de la plataforma
      const { data: platformRow } = await supabase
        .from('calculator_platforms')
        .select('currency')
        .eq('id', platform_id)
        .maybeSingle();
      const currency = (platformRow as any)?.currency || 'USD';

      // 3. Calcular montos
      const normalizedId = String(platform_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      let valueUsdBruto = 0;
      if (currency === 'EUR') {
        if (normalizedId === 'big7') valueUsdBruto = (num * rates.eur_usd) * 0.84;
        else if (normalizedId === 'mondo') valueUsdBruto = (num * rates.eur_usd) * 0.78;
        else valueUsdBruto = num * rates.eur_usd;
      } else if (currency === 'GBP') {
        if (normalizedId === 'aw') valueUsdBruto = (num * rates.gbp_usd) * 0.677;
        else valueUsdBruto = num * rates.gbp_usd;
      } else if (currency === 'USD') {
        if (normalizedId === 'cmd' || normalizedId === 'camlust' || normalizedId === 'skypvt') valueUsdBruto = num * 0.75;
        else if (normalizedId === 'chaturbate' || normalizedId === 'myfreecams' || normalizedId === 'stripchat') valueUsdBruto = num * 0.05;
        else if (normalizedId === 'dxlive') valueUsdBruto = num * 0.60;
        else if (normalizedId === 'secretfriends') valueUsdBruto = num * 0.5;
        else valueUsdBruto = num;
      } else {
        valueUsdBruto = num;
      }

      // Porcentaje de reparto de la modelo
      let platformPercentage = 80;
      if (normalizedId === 'superfoon') {
        platformPercentage = 100;
      } else {
        const { data: modelConfig } = await supabase
          .from('calculator_config')
          .select('percentage_override, group_percentage')
          .eq('model_id', model_id)
          .eq('active', true)
          .maybeSingle();
        const configPct = (modelConfig as any)?.percentage_override ?? (modelConfig as any)?.group_percentage;
        platformPercentage = configPct != null ? Number(configPct) : 80;
      }

      const valueUsdModelo = valueUsdBruto * (platformPercentage / 100);

      // 4. Insertar nuevo registro
      const { data: insertedRows, error: insertError } = await supabase
        .from('calculator_history')
        .insert({
          model_id,
          platform_id,
          value: num,
          period_date: periodDateNorm,
          period_type,
          rate_eur_usd: rates.eur_usd,
          rate_gbp_usd: rates.gbp_usd,
          rate_usd_cop: rates.usd_cop,
          platform_percentage: platformPercentage,
          value_usd_bruto: parseFloat((valueUsdBruto).toFixed(2)),
          value_usd_modelo: parseFloat((valueUsdModelo).toFixed(2)),
          value_cop_modelo: parseFloat((valueUsdModelo * rates.usd_cop).toFixed(2)),
          archived_at: new Date().toISOString()
        })
        .select();

      if (insertError) {
        console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error insertando:', insertError);
        return NextResponse.json({ success: false, error: 'Error al insertar plataforma' }, { status: 500 });
      }

      // 5. Sincronizar agregados consolidado e historiales totales
      await syncPeriodTotals(model_id, periodDateNorm, period_type);

      return NextResponse.json({
        success: true,
        data: insertedRows[0],
        message: 'Plataforma agregada al historial exitosamente'
      });
    }

    // Si el registro ya existe, tomar el primero y proceder a actualizar
    const existingRecord = existingRecords[0];
    const targetHistoryId = historyId || existingRecord.id;

    // Preparar campos a actualizar
    const updateData: Record<string, unknown> = {};

    if (value !== undefined) {
      const num = Number(value);
      if (Number.isNaN(num)) {
        return NextResponse.json({ success: false, error: 'El valor debe ser un número válido' }, { status: 400 });
      }
      updateData.value = num;

      // Recalcular montos
      const platformId = existingRecord.platform_id as string;
      const { data: platformRow } = await supabase
        .from('calculator_platforms')
        .select('currency')
        .eq('id', platformId)
        .maybeSingle();
      const currency = (platformRow as any)?.currency || 'USD';
      
      const rates = {
        eur_usd: existingRecord.rate_eur_usd ?? 1.01,
        gbp_usd: existingRecord.rate_gbp_usd ?? 1.20,
        usd_cop: existingRecord.rate_usd_cop ?? 3900
      };
      const normalizedId = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      let valueUsdBruto: number;
      if (currency === 'EUR') {
        if (normalizedId === 'big7') valueUsdBruto = (num * rates.eur_usd) * 0.84;
        else if (normalizedId === 'mondo') valueUsdBruto = (num * rates.eur_usd) * 0.78;
        else valueUsdBruto = num * rates.eur_usd;
      } else if (currency === 'GBP') {
        if (normalizedId === 'aw') valueUsdBruto = (num * rates.gbp_usd) * 0.677;
        else valueUsdBruto = num * rates.gbp_usd;
      } else if (currency === 'USD') {
        if (normalizedId === 'cmd' || normalizedId === 'camlust' || normalizedId === 'skypvt') valueUsdBruto = num * 0.75;
        else if (normalizedId === 'chaturbate' || normalizedId === 'myfreecams' || normalizedId === 'stripchat') valueUsdBruto = num * 0.05;
        else if (normalizedId === 'dxlive') valueUsdBruto = num * 0.60;
        else if (normalizedId === 'secretfriends') valueUsdBruto = num * 0.5;
        else valueUsdBruto = num;
      } else {
        valueUsdBruto = num;
      }

      let platformPercentage: number;
      if (normalizedId === 'superfoon') {
        platformPercentage = 100;
      } else {
        const { data: modelConfig } = await supabase
          .from('calculator_config')
          .select('percentage_override, group_percentage')
          .eq('model_id', existingRecord.model_id)
          .eq('active', true)
          .maybeSingle();
        const configPct = (modelConfig as any)?.percentage_override ?? (modelConfig as any)?.group_percentage;
        platformPercentage = configPct != null ? Number(configPct) : (existingRecord.platform_percentage != null ? Number(existingRecord.platform_percentage) : 80);
      }
      const valueUsdModelo = valueUsdBruto * (platformPercentage / 100);
      updateData.value_usd_bruto = parseFloat((valueUsdBruto).toFixed(2));
      updateData.value_usd_modelo = parseFloat((valueUsdModelo).toFixed(2));
      updateData.value_cop_modelo = parseFloat((valueUsdModelo * rates.usd_cop).toFixed(2));
      updateData.platform_percentage = platformPercentage;
    }

    if (value_usd_bruto !== undefined) {
      const num = Number(value_usd_bruto);
      if (!Number.isNaN(num)) updateData.value_usd_bruto = num;
    }

    if (value_usd_modelo !== undefined) {
      const num = Number(value_usd_modelo);
      if (!Number.isNaN(num)) updateData.value_usd_modelo = num;
    }

    if (value_cop_modelo !== undefined) {
      const num = Number(value_cop_modelo);
      if (!Number.isNaN(num)) updateData.value_cop_modelo = num;
    }

    // Actualizar registro
    const { data: updatedRows, error: updateError } = await supabase
      .from('calculator_history')
      .update(updateData)
      .eq('id', targetHistoryId)
      .select();

    if (updateError) {
      console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error actualizando:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Error al actualizar registro',
        detail: updateError.message || undefined
      }, { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró el registro para actualizar.'
      }, { status: 404 });
    }

    const updatedRecord = updatedRows[0];

    // Sincronizar consolidados y totales agregados
    await syncPeriodTotals(existingRecord.model_id, existingRecord.period_date, existingRecord.period_type);

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
 * POST: Actualizar tasas de un período completo y recalcular
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

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', authenticatedUserId)
      .single();

    const userRole = userData?.role || 'modelo';
    const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'superadmin_aff';

    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado: Solo admins pueden editar tasas'
      }, { status: 403 });
    }

    // Obtener todos los registros del período para recalcular (excluyendo __CONSOLIDATED_TOTAL__)
    const { data: periodRecords, error: fetchError } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('model_id', model_id)
      .eq('period_date', period_date)
      .eq('period_type', period_type)
      .neq('platform_id', '__CONSOLIDATED_TOTAL__');

    if (fetchError) {
      console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error obteniendo registros:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Error al obtener registros del período'
      }, { status: 500 });
    }

    if (!periodRecords || periodRecords.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron registros de plataformas para este período'
      }, { status: 404 });
    }

    // Obtener información de plataformas (currency)
    const platformIds = Array.from(new Set(periodRecords.map((r: any) => r.platform_id).filter(Boolean)));
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, currency')
      .in('id', platformIds);

    if (platformsError) {
      console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error obteniendo plataformas:', platformsError);
      return NextResponse.json({
        success: false,
        error: 'Error al obtener información de plataformas'
      }, { status: 500 });
    }

    const platformMap = new Map((platforms || []).map((p: any) => [p.id, p]));

    // Tasas actualizadas
    const newRates = {
      eur_usd: rates.eur_usd !== undefined ? Number(rates.eur_usd) : (periodRecords[0] as any).rate_eur_usd || 1.01,
      gbp_usd: rates.gbp_usd !== undefined ? Number(rates.gbp_usd) : (periodRecords[0] as any).rate_gbp_usd || 1.20,
      usd_cop: rates.usd_cop !== undefined ? Number(rates.usd_cop) : (periodRecords[0] as any).rate_usd_cop || 3900
    };

    // Helper para recalcular usdBruto
    const calculateUsdBruto = (value: number, platformId: string, currency: string, r: typeof newRates): number => {
      const normalizedId = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (currency === 'EUR') {
        if (normalizedId === 'big7') return (value * r.eur_usd) * 0.84;
        if (normalizedId === 'mondo') return (value * r.eur_usd) * 0.78;
        return value * r.eur_usd;
      } else if (currency === 'GBP') {
        if (normalizedId === 'aw') return (value * r.gbp_usd) * 0.677;
        return value * r.gbp_usd;
      } else if (currency === 'USD') {
        if (normalizedId === 'cmd' || normalizedId === 'camlust' || normalizedId === 'skypvt') return value * 0.75;
        if (normalizedId === 'chaturbate' || normalizedId === 'myfreecams' || normalizedId === 'stripchat') return value * 0.05;
        if (normalizedId === 'dxlive') return value * 0.60;
        if (normalizedId === 'secretfriends') return value * 0.5;
        return value;
      }
      return value;
    };

    // Actualizar todos los registros con tasas recalculadas
    let updatedCount = 0;
    for (const record of periodRecords) {
      const platform = platformMap.get(record.platform_id);
      const currency = platform?.currency || 'USD';
      const originalValue = Number(record.value) || 0;
      const platformPercentage = record.platform_percentage || 80;

      const valueUsdBruto = calculateUsdBruto(originalValue, record.platform_id, currency, newRates);
      const valueUsdModelo = valueUsdBruto * (platformPercentage / 100);
      const valueCopModelo = valueUsdModelo * newRates.usd_cop;

      const { error: updateError } = await supabase
        .from('calculator_history')
        .update({
          rate_eur_usd: newRates.eur_usd,
          rate_gbp_usd: newRates.gbp_usd,
          rate_usd_cop: newRates.usd_cop,
          value_usd_bruto: parseFloat(valueUsdBruto.toFixed(2)),
          value_usd_modelo: parseFloat(valueUsdModelo.toFixed(2)),
          value_cop_modelo: parseFloat(valueCopModelo.toFixed(2))
        })
        .eq('id', record.id);

      if (updateError) {
        console.error(`❌ [CALCULATOR-HISTORIAL-UPDATE] Error actualizando tasas en registro ${record.id}:`, updateError);
        continue;
      }
      updatedCount++;
    }

    // Sincronizar consolidados y agregados de totales con tasas actualizadas
    await syncPeriodTotals(model_id, period_date, period_type);

    console.log(`✅ [CALCULATOR-HISTORIAL-UPDATE] ${updatedCount} registros actualizados con nuevas tasas por admin ${authenticatedUserId}`);

    return NextResponse.json({
      success: true,
      updated_count: updatedCount,
      message: `Tasas y valores recalculados exitosamente para ${updatedCount} registros.`
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error en tasas:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

/**
 * DELETE: Eliminar una plataforma de un período archivado
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period_date = searchParams.get('period_date');
    const period_type = searchParams.get('period_type');
    const model_id = searchParams.get('model_id');
    const platform_id = searchParams.get('platform_id');

    if (!period_date || !period_type || !model_id || !platform_id) {
      return NextResponse.json({
        success: false,
        error: 'period_date, period_type, model_id y platform_id son requeridos'
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
        console.warn('⚠️ [CALCULATOR-HISTORIAL-DELETE] Error verificando autenticación:', error);
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
    const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'superadmin_aff';

    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado: Solo admins pueden eliminar del historial'
      }, { status: 403 });
    }

    // Normalizar period_date a YYYY-MM-DD
    const periodDateNorm = typeof period_date === 'string' ? period_date.slice(0, 10) : String(period_date).slice(0, 10);

    // Borrar el registro
    const { error: deleteError } = await supabase
      .from('calculator_history')
      .delete()
      .eq('model_id', model_id)
      .eq('period_date', periodDateNorm)
      .eq('period_type', period_type)
      .eq('platform_id', platform_id);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    // Sincronizar consolidado e historiales totales
    await syncPeriodTotals(model_id, periodDateNorm, period_type);

    return NextResponse.json({
      success: true,
      message: 'Plataforma eliminada del historial exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-HISTORIAL-DELETE] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

/**
 * 🔄 Sincronizador de Totales Consolidados de Histórico
 * Recalcula la fila '__CONSOLIDATED_TOTAL__' en calculator_history e impacta en calculator_totals
 */
async function syncPeriodTotals(modelId: string, periodDate: string, periodType: string) {
  try {
    const periodDateNorm = typeof periodDate === 'string' ? periodDate.slice(0, 10) : String(periodDate).slice(0, 10);

    // 1. Obtener todas las plataformas asociadas a este período (excluyendo __CONSOLIDATED_TOTAL__)
    const { data: rows } = await supabase
      .from('calculator_history')
      .select('value, value_usd_bruto, value_usd_modelo, value_cop_modelo')
      .eq('model_id', modelId)
      .eq('period_date', periodDateNorm)
      .eq('period_type', periodType)
      .neq('platform_id', '__CONSOLIDATED_TOTAL__');

    if (!rows || rows.length === 0) {
      // Si ya no quedan registros, limpiar también los consolidados
      await supabase
        .from('calculator_history')
        .delete()
        .eq('model_id', modelId)
        .eq('period_date', periodDateNorm)
        .eq('period_type', periodType)
        .eq('platform_id', '__CONSOLIDATED_TOTAL__');

      await supabase
        .from('calculator_totals')
        .delete()
        .eq('model_id', modelId)
        .eq('period_date', periodDateNorm);

      return;
    }

    // Calcular agregados
    const sumValue = rows.reduce((s, r) => s + Number(r.value || 0), 0);
    const sumUsdBruto = rows.reduce((s, r) => s + Number(r.value_usd_bruto || 0), 0);
    const sumUsdModelo = rows.reduce((s, r) => s + Number(r.value_usd_modelo || 0), 0);
    const sumCopModelo = rows.reduce((s, r) => s + Number(r.value_cop_modelo || 0), 0);

    // Obtener tasas del período de algún registro hermano
    const { data: sibling } = await supabase
      .from('calculator_history')
      .select('rate_eur_usd, rate_gbp_usd, rate_usd_cop')
      .eq('model_id', modelId)
      .eq('period_date', periodDateNorm)
      .eq('period_type', periodType)
      .neq('platform_id', '__CONSOLIDATED_TOTAL__')
      .limit(1)
      .maybeSingle();

    const rates = sibling || { rate_eur_usd: 1.01, rate_gbp_usd: 1.20, rate_usd_cop: 3900 };

    // 2. Upsert del __CONSOLIDATED_TOTAL__ en calculator_history
    const { data: existingConsolidated } = await supabase
      .from('calculator_history')
      .select('id')
      .eq('model_id', modelId)
      .eq('period_date', periodDateNorm)
      .eq('period_type', periodType)
      .eq('platform_id', '__CONSOLIDATED_TOTAL__')
      .maybeSingle();

    if (existingConsolidated) {
      await supabase
        .from('calculator_history')
        .update({
          value: sumValue,
          rate_eur_usd: rates.rate_eur_usd,
          rate_gbp_usd: rates.rate_gbp_usd,
          rate_usd_cop: rates.rate_usd_cop,
          value_usd_bruto: parseFloat(sumUsdBruto.toFixed(2)),
          value_usd_modelo: parseFloat(sumUsdModelo.toFixed(2)),
          value_cop_modelo: parseFloat(sumCopModelo.toFixed(2))
        })
        .eq('id', existingConsolidated.id);
    } else {
      await supabase
        .from('calculator_history')
        .insert({
          model_id: modelId,
          platform_id: '__CONSOLIDATED_TOTAL__',
          value: sumValue,
          period_date: periodDateNorm,
          period_type: periodType,
          rate_eur_usd: rates.rate_eur_usd,
          rate_gbp_usd: rates.rate_gbp_usd,
          rate_usd_cop: rates.rate_usd_cop,
          platform_percentage: 0,
          value_usd_bruto: parseFloat(sumUsdBruto.toFixed(2)),
          value_usd_modelo: parseFloat(sumUsdModelo.toFixed(2)),
          value_cop_modelo: parseFloat(sumCopModelo.toFixed(2)),
          archived_at: new Date().toISOString()
        });
    }

    // 3. Upsert en calculator_totals
    const { error: totalsError } = await supabase
      .from('calculator_totals')
      .upsert({
        model_id: modelId,
        period_date: periodDateNorm,
        total_usd_bruto: parseFloat(sumUsdBruto.toFixed(2)),
        total_usd_modelo: parseFloat(sumUsdModelo.toFixed(2)),
        total_cop_modelo: parseFloat(sumCopModelo.toFixed(2)),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'model_id,period_date'
      });

    if (totalsError) {
      console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error al sincronizar calculator_totals:', totalsError);
    } else {
      console.log(`✅ [CALCULATOR-HISTORIAL-UPDATE] Sincronización de totales completada para ${modelId} período ${periodDateNorm}`);
    }

  } catch (e) {
    console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error en syncPeriodTotals:', e);
  }
}
