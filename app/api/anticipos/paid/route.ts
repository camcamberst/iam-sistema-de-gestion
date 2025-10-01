import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Forzar renderizado dinámico
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// 📋 GET - Obtener anticipos pagados/realizados
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const periodDate = searchParams.get('periodDate');

    console.log('🔍 [API ANTICIPOS PAID] GET request:', { modelId, periodDate });

    if (!modelId) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId es requerido' 
      }, { status: 400 });
    }

    let query = supabase
      .from('anticipos')
      .select('monto_solicitado, estado, created_at')
      .eq('model_id', modelId)
      .eq('estado', 'realizado');

    if (periodDate) {
      // Filtrar por período específico
      const { data: period } = await supabase
        .from('periods')
        .select('id')
        .eq('start_date', periodDate)
        .single();

      if (period) {
        query = query.eq('period_id', period.id);
      }
    }

    const { data: anticipos, error } = await query;

    if (error) {
      console.error('❌ [API ANTICIPOS PAID] Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Calcular total pagado
    const total = anticipos?.reduce((sum, anticipo) => sum + (anticipo.monto_solicitado || 0), 0) || 0;

    console.log('✅ [API ANTICIPOS PAID] Total pagado:', total);

    return NextResponse.json({
      success: true,
      total,
      count: anticipos?.length || 0,
      anticipos: anticipos || []
    });

  } catch (error: any) {
    console.error('❌ [API ANTICIPOS PAID] Error general:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
