import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getCurrentPeriodType } from '@/utils/period-closure-dates';
import { updateClosureStatus } from '@/lib/calculator/period-closure-helpers';
import { isValidTransition } from '@/lib/calculator/period-closure-states';

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
 * POST: Cierre manual para casos de recuperación
 * Solo para admins/super_admins
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Token de autorización requerido'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Verificar que es admin o super_admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para realizar cierre manual'
      }, { status: 403 });
    }

    const body = await request.json();
    const { periodDate, targetStatus, force } = body;

    if (!periodDate || !targetStatus) {
      return NextResponse.json({
        success: false,
        error: 'periodDate y targetStatus son requeridos'
      }, { status: 400 });
    }

    const currentDate = periodDate || getColombiaDate();
    const periodType = getCurrentPeriodType();

    // Obtener estado actual
    const { data: currentStatus } = await supabase
      .from('calculator_period_closure_status')
      .select('*')
      .eq('period_date', currentDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (currentStatus && !force) {
      // Verificar transición válida
      if (!isValidTransition(currentStatus.status, targetStatus)) {
        return NextResponse.json({
          success: false,
          error: `Transición inválida: ${currentStatus.status} -> ${targetStatus}`,
          current_status: currentStatus.status,
          valid_next: ['pending', 'early_freezing', 'closing_calculators', 'waiting_summary', 'closing_summary', 'archiving', 'completed', 'failed']
        }, { status: 400 });
      }
    }

    // Actualizar estado
    await updateClosureStatus(currentDate, periodType, targetStatus as any, {
      manual_closure: true,
      executed_by: user.id,
      executed_at: new Date().toISOString(),
      previous_status: currentStatus?.status || null
    });

    console.log(`✅ [MANUAL-CLOSE] Estado actualizado manualmente: ${currentStatus?.status || 'none'} -> ${targetStatus}`);

    return NextResponse.json({
      success: true,
      message: 'Estado actualizado manualmente',
      period_date: currentDate,
      period_type: periodType,
      previous_status: currentStatus?.status || null,
      new_status: targetStatus,
      executed_by: user.id
    });

  } catch (error) {
    console.error('❌ [MANUAL-CLOSE] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

