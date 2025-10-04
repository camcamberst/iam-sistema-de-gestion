import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, createPeriodIfNeeded } from '@/utils/calculator-dates';

// Usar service role key para bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// GET: Verificar anticipos en la base de datos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [DEBUG VERIFICAR ANTICIPOS] Verificando anticipos para modelId:', modelId, 'periodDate:', periodDate);
    
    // 1. Crear período si no existe
    await createPeriodIfNeeded(periodDate);

    // 2. Obtener el período actual
    const { data: period, error: periodError } = await supabase
      .from('periods')
      .select('id, name, start_date, end_date')
      .eq('start_date', periodDate)
      .single();

    if (periodError) {
      console.error('❌ [DEBUG VERIFICAR ANTICIPOS] Error al obtener período:', periodError);
      return NextResponse.json({ success: false, error: 'Error al obtener período' }, { status: 500 });
    }

    console.log('🔍 [DEBUG VERIFICAR ANTICIPOS] Período encontrado:', period);

    // 3. Obtener TODOS los anticipos de la modelo (sin filtros)
    const { data: allAnticipos, error: allError } = await supabase
      .from('anticipos')
      .select('id, monto_solicitado, estado, created_at, period_id')
      .eq('model_id', modelId)
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ [DEBUG VERIFICAR ANTICIPOS] Error al obtener todos los anticipos:', allError);
      return NextResponse.json({ success: false, error: 'Error al obtener anticipos' }, { status: 500 });
    }

    console.log('🔍 [DEBUG VERIFICAR ANTICIPOS] Todos los anticipos de la modelo:', allAnticipos);

    // 4. Obtener anticipos del período actual
    const { data: periodAnticipos, error: periodAnticiposError } = await supabase
      .from('anticipos')
      .select('id, monto_solicitado, estado, created_at, period_id')
      .eq('model_id', modelId)
      .eq('period_id', period.id);

    if (periodAnticiposError) {
      console.error('❌ [DEBUG VERIFICAR ANTICIPOS] Error al obtener anticipos del período:', periodAnticiposError);
      return NextResponse.json({ success: false, error: 'Error al obtener anticipos del período' }, { status: 500 });
    }

    console.log('🔍 [DEBUG VERIFICAR ANTICIPOS] Anticipos del período actual:', periodAnticipos);

    // 5. Obtener anticipos realizados del período actual
    const { data: realizadosPeriod, error: realizadosPeriodError } = await supabase
      .from('anticipos')
      .select('id, monto_solicitado, estado, created_at, period_id')
      .eq('model_id', modelId)
      .eq('period_id', period.id)
      .eq('estado', 'realizado');

    if (realizadosPeriodError) {
      console.error('❌ [DEBUG VERIFICAR ANTICIPOS] Error al obtener anticipos realizados del período:', realizadosPeriodError);
      return NextResponse.json({ success: false, error: 'Error al obtener anticipos realizados del período' }, { status: 500 });
    }

    console.log('🔍 [DEBUG VERIFICAR ANTICIPOS] Anticipos realizados del período actual:', realizadosPeriod);

    // 6. Obtener todos los estados de anticipos para esta modelo
    const { data: estadosAnticipos, error: estadosError } = await supabase
      .from('anticipos')
      .select('estado')
      .eq('model_id', modelId);

    if (estadosError) {
      console.error('❌ [DEBUG VERIFICAR ANTICIPOS] Error al obtener estados:', estadosError);
    }

    // 7. Contar por estado
    const conteoEstados = estadosAnticipos?.reduce((acc: any, anticipo: any) => {
      acc[anticipo.estado] = (acc[anticipo.estado] || 0) + 1;
      return acc;
    }, {}) || {};

    console.log('🔍 [DEBUG VERIFICAR ANTICIPOS] Conteo por estado:', conteoEstados);

    // 8. Calcular totales
    const totalRealizadosPeriod = realizadosPeriod?.reduce((sum, a) => sum + (a.monto_solicitado || 0), 0) || 0;

    console.log('🔍 [DEBUG VERIFICAR ANTICIPOS] Total realizados del período:', totalRealizadosPeriod);

    return NextResponse.json({
      success: true,
      data: {
        period: period,
        allAnticipos: allAnticipos || [],
        periodAnticipos: periodAnticipos || [],
        realizadosPeriod: realizadosPeriod || [],
        totalRealizadosPeriod,
        conteoEstados,
        analysis: {
          tieneAnticipos: (allAnticipos?.length || 0) > 0,
          tieneAnticiposEnPeriodo: (periodAnticipos?.length || 0) > 0,
          tieneAnticiposRealizados: (realizadosPeriod?.length || 0) > 0,
          problema: (realizadosPeriod?.length || 0) === 0 ? 
            'No hay anticipos realizados en el período actual' : 
            'Hay anticipos realizados en el período actual'
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG VERIFICAR ANTICIPOS] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
