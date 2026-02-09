/**
 * 🔧 API DE EDICIÓN PARA ADMINS - HISTORIAL DE CALCULADORA
 * Permite a admins y super_admins editar valores y tasas en períodos archivados.
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

    if (fetchError || !existingRecords || existingRecords.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Registro no encontrado'
      }, { status: 404 });
    }

    // Si hay múltiples registros (poco probable pero posible), tomar el primero
    const existingRecord = existingRecords[0];
    const targetHistoryId = historyId || existingRecord.id;

    // Preparar campos a actualizar (calculator_history puede no tener updated_at en el esquema)
    const updateData: Record<string, unknown> = {};

    if (value !== undefined) {
      const num = Number(value);
      if (Number.isNaN(num)) {
        return NextResponse.json({ success: false, error: 'El valor debe ser un número válido' }, { status: 400 });
      }
      updateData.value = num;

      // Recalcular USD bruto, USD modelo y COP modelo para que los totales del período se actualicen
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
      // Usar porcentaje de la fila; si no tiene, el de la modelo en calculator_config (igual que en GET historial)
      let platformPercentage: number;
      if (existingRecord.platform_percentage != null) {
        platformPercentage = Number(existingRecord.platform_percentage);
      } else if (normalizedId === 'superfoon') {
        platformPercentage = 100;
      } else {
        const { data: modelConfig } = await supabase
          .from('calculator_config')
          .select('percentage_override, group_percentage')
          .eq('model_id', existingRecord.model_id)
          .eq('active', true)
          .maybeSingle();
        platformPercentage = (modelConfig as any)?.percentage_override ?? (modelConfig as any)?.group_percentage ?? 80;
      }
      const valueUsdModelo = valueUsdBruto * (platformPercentage / 100);
      updateData.value_usd_bruto = parseFloat((valueUsdBruto).toFixed(2));
      updateData.value_usd_modelo = parseFloat((valueUsdModelo).toFixed(2));
      updateData.value_cop_modelo = parseFloat((valueUsdModelo * rates.usd_cop).toFixed(2));
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

    // Actualizar registro (sin .single() para evitar error cuando 0 filas y dar mensaje claro)
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
        error: 'No se encontró el registro para actualizar. Puede que el historial haya cambiado.'
      }, { status: 404 });
    }

    const updatedRecord = updatedRows[0];

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

    // Primero, obtener todos los registros del período para recalcular
    const { data: periodRecords, error: fetchError } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('model_id', model_id)
      .eq('period_date', period_date)
      .eq('period_type', period_type);

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
        error: 'No se encontraron registros para este período'
      }, { status: 404 });
    }

    // Obtener información de plataformas (currency)
    const platformIds = Array.from(new Set(periodRecords.map((r: any) => r.platform_id).filter(Boolean)));
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, currency')
      .eq('active', true)
      .in('id', platformIds);

    if (platformsError) {
      console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error obteniendo plataformas:', platformsError);
      return NextResponse.json({
        success: false,
        error: 'Error al obtener información de plataformas'
      }, { status: 500 });
    }

    const platformMap = new Map((platforms || []).map((p: any) => [p.id, p]));

    // Preparar las nuevas tasas (usar las nuevas o mantener las existentes si no se proporcionaron)
    const newRates = {
      eur_usd: rates.eur_usd !== undefined ? Number(rates.eur_usd) : (periodRecords[0] as any).rate_eur_usd || 1.01,
      gbp_usd: rates.gbp_usd !== undefined ? Number(rates.gbp_usd) : (periodRecords[0] as any).rate_gbp_usd || 1.20,
      usd_cop: rates.usd_cop !== undefined ? Number(rates.usd_cop) : (periodRecords[0] as any).rate_usd_cop || 3900
    };

    // Función helper para calcular USD bruto (misma lógica que en period-closure-helpers)
    const calculateUsdBruto = (value: number, platformId: string, currency: string, rates: any): number => {
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
      const valueUsdBruto = calculateUsdBruto(originalValue, record.platform_id, currency, newRates);
      
      // Recalcular USD modelo
      const valueUsdModelo = valueUsdBruto * (platformPercentage / 100);
      
      // Recalcular COP modelo
      const valueCopModelo = valueUsdModelo * newRates.usd_cop;

      return {
        id: record.id,
        rate_eur_usd: newRates.eur_usd,
        rate_gbp_usd: newRates.gbp_usd,
        rate_usd_cop: newRates.usd_cop,
        value_usd_bruto: parseFloat(valueUsdBruto.toFixed(2)),
        value_usd_modelo: parseFloat(valueUsdModelo.toFixed(2)),
        value_cop_modelo: parseFloat(valueCopModelo.toFixed(2))
      };
    });

    // Actualizar todos los registros
    let updatedCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('calculator_history')
        .update({
          rate_eur_usd: update.rate_eur_usd,
          rate_gbp_usd: update.rate_gbp_usd,
          rate_usd_cop: update.rate_usd_cop,
          value_usd_bruto: update.value_usd_bruto,
          value_usd_modelo: update.value_usd_modelo,
          value_cop_modelo: update.value_cop_modelo
        })
        .eq('id', update.id);

      if (updateError) {
        console.error(`❌ [CALCULATOR-HISTORIAL-UPDATE] Error actualizando registro ${update.id}:`, updateError);
        continue;
      }
      updatedCount++;
    }

    console.log(`✅ [CALCULATOR-HISTORIAL-UPDATE] ${updatedCount} de ${updates.length} registros actualizados con nuevas tasas y valores recalculados`);

    return NextResponse.json({
      success: true,
      updated_count: updatedCount,
      message: `Tasas y valores recalculados exitosamente para ${updatedCount} registros del período.`
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-HISTORIAL-UPDATE] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

