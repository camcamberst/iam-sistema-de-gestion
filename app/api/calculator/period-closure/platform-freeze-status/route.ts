import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/period-closure-dates';
import { getFrozenPlatformsForModel } from '@/lib/calculator/period-closure-helpers';

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
 * GET: Obtiene el estado de congelación de plataformas para un modelo
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const periodDate = searchParams.get('periodDate') || getColombiaDate();

    if (!modelId) {
      return NextResponse.json({
        success: false,
        error: 'modelId es requerido'
      }, { status: 400 });
    }

    // Obtener plataformas congeladas para este modelo
    const frozenPlatforms = await getFrozenPlatformsForModel(periodDate, modelId);

    return NextResponse.json({
      success: true,
      model_id: modelId,
      period_date: periodDate,
      frozen_platforms: frozenPlatforms,
      is_frozen: frozenPlatforms.length > 0
    });

  } catch (error) {
    console.error('❌ [PLATFORM-FREEZE-STATUS] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

