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
 * Cron job que genera automáticamente la planilla de Stats cuando inicia un nuevo mes
 * Se ejecuta el día 1 de cada mes a las 00:05 hora Colombia
 * Genera la planilla completa del mes con ambos períodos (P1 y P2)
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

    // Verificar si es día 1 del mes (inicio de mes)
    const isMonthStart = day === 1;

    if (!isMonthStart) {
      return NextResponse.json({
        success: true,
        message: 'No es día 1 del mes',
        currentDate: colombiaDate,
        day
      });
    }

    console.log(`📊 [CRON-GENERATE-SHEET] Iniciando generación automática de planilla mensual para ${year}-${String(month).padStart(2, '0')}`);

    // Verificar si ya existe la planilla del mes (verificando ambos períodos)
    const periodDateP1 = `${year}-${String(month).padStart(2, '0')}-01`;
    const periodDateP2 = `${year}-${String(month).padStart(2, '0')}-16`;

    const { data: existing } = await supabase
      .from('gestor_stats_values')
      .select('id')
      .in('period_date', [periodDateP1, periodDateP2])
      .limit(1)
      .single();

    if (existing) {
      console.log(`✅ [CRON-GENERATE-SHEET] La planilla ya existe para este mes`);
      return NextResponse.json({
        success: true,
        message: 'La planilla ya existe para este mes',
        year,
        month
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
          year,
          month
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

      console.log(`✅ [CRON-GENERATE-SHEET] Planilla mensual generada exitosamente:`, result);

      return NextResponse.json({
        success: true,
        message: 'Planilla mensual generada exitosamente',
        year,
        month,
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

