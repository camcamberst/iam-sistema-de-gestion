import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener historial de ganancias diarias
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '30');

    console.log('🔍 [DAILY-EARNINGS-HISTORY] Consultando historial:', { 
      modelId, startDate, endDate, limit 
    });

    // Construir query base
    let query = supabase
      .from('daily_earnings_history')
      .select(`
        model_id,
        earnings_date,
        earnings_amount,
        archived_at,
        users!inner(name, email)
      `)
      .order('earnings_date', { ascending: false })
      .limit(limit);

    // Aplicar filtros
    if (modelId) {
      query = query.eq('model_id', modelId);
    }
    
    if (startDate) {
      query = query.gte('earnings_date', startDate);
    }
    
    if (endDate) {
      query = query.lte('earnings_date', endDate);
    }

    const { data: history, error } = await query;

    if (error) {
      console.error('❌ [DAILY-EARNINGS-HISTORY] Error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || 'Error consultando historial'
      }, { status: 500 });
    }

    // Formatear datos para respuesta
    const formattedHistory = history?.map(item => ({
      modelId: item.model_id,
      modelName: item.users?.name || item.users?.email || 'Modelo desconocido',
      earningsDate: item.earnings_date,
      earningsAmount: item.earnings_amount,
      archivedAt: item.archived_at
    })) || [];

    console.log('✅ [DAILY-EARNINGS-HISTORY] Historial obtenido:', formattedHistory.length, 'registros');

    return NextResponse.json({
      success: true,
      history: formattedHistory,
      total: formattedHistory.length,
      filters: {
        modelId,
        startDate,
        endDate,
        limit
      }
    });

  } catch (error: any) {
    console.error('❌ [DAILY-EARNINGS-HISTORY] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// POST: Archivar ganancias manualmente (solo para admins)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, date } = body;

    console.log('🔄 [DAILY-EARNINGS-HISTORY] Acción manual:', { action, date });

    if (action === 'archive') {
      // Archivar ganancias de una fecha específica
      const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase.rpc('archive_daily_earnings');
      
      if (error) {
        console.error('❌ [DAILY-EARNINGS-HISTORY] Error archivando:', error);
        return NextResponse.json({
          success: false,
          error: error.message || 'Error archivando ganancias'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Ganancias archivadas para la fecha ${targetDate}`,
        data: data
      });

    } else if (action === 'reset') {
      // Reiniciar ganancias del día actual
      const { data, error } = await supabase.rpc('reset_today_earnings');
      
      if (error) {
        console.error('❌ [DAILY-EARNINGS-HISTORY] Error reiniciando:', error);
        return NextResponse.json({
          success: false,
          error: error.message || 'Error reiniciando ganancias'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Ganancias del día actual reiniciadas',
        data: data
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Acción no válida. Use "archive" o "reset"'
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ [DAILY-EARNINGS-HISTORY] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
