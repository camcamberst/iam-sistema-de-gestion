import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

async function authenticateAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'No autorizado', user: null };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: 'Token inválido', user: null };
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userData || (userData.role !== 'admin' && userData.role !== 'superadmin')) {
    return { error: 'No tienes permisos de administrador', user: null };
  }

  return { error: null, user };
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({
        success: false,
        error: 'modelId es requerido'
      }, { status: 400 });
    }

    console.log('🔍 [DIAGNOSE] Diagnosticando valores para modelo:', modelId);

    // 1. Obtener TODOS los valores en model_values (sin filtro de período)
    const { data: allModelValues, error: mvError } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date, updated_at')
      .eq('model_id', modelId)
      .order('period_date', { ascending: false })
      .order('updated_at', { ascending: false });

    // 2. Obtener TODOS los totales en calculator_totals
    const { data: allTotals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('period_date, total_usd_bruto, total_usd_modelo, updated_at')
      .eq('model_id', modelId)
      .order('period_date', { ascending: false })
      .order('updated_at', { ascending: false });

    // 3. Obtener valores específicos de P2 de diciembre
    const startDate = '2025-12-16';
    const endDate = '2025-12-31';
    const fechaLimite = new Date(`${endDate}T23:59:59.999Z`);
    const fechaLimiteISO = fechaLimite.toISOString();

    const { data: p2Values, error: p2Error } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date, updated_at')
      .eq('model_id', modelId)
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .order('updated_at', { ascending: false });

    // 4. Obtener valores de P2 con filtro de updated_at
    const { data: p2ValuesFiltered, error: p2FilteredError } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date, updated_at')
      .eq('model_id', modelId)
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .lte('updated_at', fechaLimiteISO)
      .order('updated_at', { ascending: false });

    // 5. Obtener valores de P2 SIN filtro de updated_at (lo que debería eliminar el modo forzado)
    const { data: p2ValuesAll, error: p2AllError } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date, updated_at')
      .eq('model_id', modelId)
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .order('updated_at', { ascending: false });

    // 6. Obtener email del modelo
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', modelId)
      .single();

    // Agrupar valores por período
    const valuesByPeriod = new Map<string, any[]>();
    allModelValues?.forEach((v: any) => {
      const period = v.period_date;
      if (!valuesByPeriod.has(period)) {
        valuesByPeriod.set(period, []);
      }
      valuesByPeriod.get(period)!.push(v);
    });

    return NextResponse.json({
      success: true,
      model_id: modelId,
      email: userData?.email || 'N/A',
      diagnostic: {
        // Todos los valores en model_values
        all_model_values: {
          total: allModelValues?.length || 0,
          by_period: Array.from(valuesByPeriod.entries()).map(([period, values]) => ({
            period,
            count: values.length,
            platforms: values.map((v: any) => ({
              platform_id: v.platform_id,
              value: v.value,
              updated_at: v.updated_at
            }))
          }))
        },
        // Todos los totales en calculator_totals
        all_totals: {
          total: allTotals?.length || 0,
          totals: allTotals?.map((t: any) => ({
            period_date: t.period_date,
            total_usd_bruto: t.total_usd_bruto,
            total_usd_modelo: t.total_usd_modelo,
            updated_at: t.updated_at
          })) || []
        },
        // Valores específicos de P2 de diciembre (sin filtro de updated_at)
        p2_december_all: {
          total: p2ValuesAll?.length || 0,
          values: p2ValuesAll?.map((v: any) => ({
            platform_id: v.platform_id,
            value: v.value,
            period_date: v.period_date,
            updated_at: v.updated_at,
            is_after_limit: new Date(v.updated_at) > fechaLimite
          })) || []
        },
        // Valores de P2 con filtro de updated_at
        p2_december_filtered: {
          total: p2ValuesFiltered?.length || 0,
          limit: fechaLimiteISO,
          values: p2ValuesFiltered?.map((v: any) => ({
            platform_id: v.platform_id,
            value: v.value,
            period_date: v.period_date,
            updated_at: v.updated_at
          })) || []
        },
        // Valores de P2 sin filtro (lo que se encontró en la búsqueda inicial)
        p2_december_found: {
          total: p2Values?.length || 0,
          values: p2Values?.map((v: any) => ({
            platform_id: v.platform_id,
            value: v.value,
            period_date: v.period_date,
            updated_at: v.updated_at,
            is_after_limit: new Date(v.updated_at) > fechaLimite
          })) || []
        },
        // Resumen
        summary: {
          total_values_all_periods: allModelValues?.length || 0,
          total_totals_all_periods: allTotals?.length || 0,
          p2_values_total: p2ValuesAll?.length || 0,
          p2_values_after_limit: p2ValuesAll?.filter((v: any) => new Date(v.updated_at) > fechaLimite).length || 0,
          p2_values_before_limit: p2ValuesFiltered?.length || 0,
          periods_with_values: Array.from(valuesByPeriod.keys())
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [DIAGNOSE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

