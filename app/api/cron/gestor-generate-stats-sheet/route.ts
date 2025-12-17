import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecretKey = process.env.CRON_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/cron/gestor-generate-stats-sheet
 * 
 * Cron job que genera automáticamente la planilla de Stats cuando inicia un nuevo período
 * Se ejecuta los días 1 y 16 de cada mes a las 00:00 hora Colombia
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación del cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');

    if (cronSecretKey && cronSecret !== cronSecretKey && authHeader !== `Bearer ${cronSecretKey}`) {
      console.error('❌ [CRON-GENERATE-SHEET] Acceso no autorizado');
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 });
    }

    const colombiaDate = getColombiaDate();
    const [year, month, day] = colombiaDate.split('-').map(Number);

    // Verificar si es día de inicio de período (1 o 16)
    const isPeriodStart = day === 1 || day === 16;

    if (!isPeriodStart) {
      return NextResponse.json({
        success: true,
        message: 'No es día de inicio de período',
        currentDate: colombiaDate,
        day
      });
    }

    // Determinar período
    const periodType = day === 1 ? '1-15' : '16-31';
    const periodDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    console.log(`📊 [CRON-GENERATE-SHEET] Iniciando generación automática de planilla para período ${periodDate} (${periodType})`);

    // Verificar si ya existe la planilla
    const { data: existing } = await supabase
      .from('gestor_stats_values')
      .select('id')
      .eq('period_date', periodDate)
      .eq('period_type', periodType)
      .limit(1)
      .single();

    if (existing) {
      console.log(`✅ [CRON-GENERATE-SHEET] La planilla ya existe para este período`);
      return NextResponse.json({
        success: true,
        message: 'La planilla ya existe para este período',
        periodDate,
        periodType
      });
    }

    // Llamar al endpoint de generación
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const generateUrl = `${baseUrl}/api/gestor/stats/generate-sheet`;

    try {
      const response = await fetch(generateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecretKey || 'internal'}`
        },
        body: JSON.stringify({
          periodDate,
          periodType
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ [CRON-GENERATE-SHEET] Error generando planilla:', result);
        return NextResponse.json({
          success: false,
          error: 'Error generando planilla',
          details: result
        }, { status: 500 });
      }

      console.log(`✅ [CRON-GENERATE-SHEET] Planilla generada exitosamente:`, result);

      return NextResponse.json({
        success: true,
        message: 'Planilla generada exitosamente',
        periodDate,
        periodType,
        ...result
      });

    } catch (fetchError: any) {
      console.error('❌ [CRON-GENERATE-SHEET] Error llamando al endpoint de generación:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Error llamando al endpoint de generación',
        details: fetchError.message
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ [CRON-GENERATE-SHEET] Error inesperado:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}

