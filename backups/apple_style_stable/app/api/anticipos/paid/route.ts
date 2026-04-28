import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAnticiposConfirmadosDelMes } from '@/lib/anticipos/anticipos-utils';

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

    // Usar función centralizada para obtener anticipos del mes
    const anticiposResult = await getAnticiposConfirmadosDelMes(modelId, periodDate || undefined);
    const total = anticiposResult.total;
    const anticipos = anticiposResult.anticipos;

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
