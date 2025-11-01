import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getCurrentPeriodType } from '@/utils/period-closure-dates';

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

/**
 * GET: Verifica el estado actual del cierre de período
 */
export async function GET(request: NextRequest) {
  try {
    const currentDate = getColombiaDate();
    const periodType = getCurrentPeriodType();

    // Obtener estado actual del cierre
    const { data: status, error } = await supabase
      .from('calculator_period_closure_status')
      .select('*')
      .eq('period_date', currentDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ [CHECK-STATUS] Error obteniendo estado:', error);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo estado'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      period_date: currentDate,
      period_type: periodType,
      status: status || null,
      is_closing: status?.status && status.status !== 'completed' && status.status !== 'failed'
    });

  } catch (error) {
    console.error('❌ [CHECK-STATUS] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

