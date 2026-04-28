import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/period-closure-dates';
import { sendBotNotification } from '@/lib/chat/bot-notifications';
import { getNetoPagarForPeriod } from '@/lib/savings/savings-utils';


export const dynamic = 'force-dynamic';

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
 * GET: Enviar recordatorios de ventana de ahorro
 * Se ejecuta diariamente durante las ventanas de solicitud:
 * - P1: días 16, 17, 18
 * - P2: días 1, 2, 3
 */
export async function GET(request: NextRequest) {
  try {
    const colombiaDate = getColombiaDate();
    const today = new Date(colombiaDate);
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1;
    const todayYear = today.getFullYear();

    // Verificar si estamos en una ventana de solicitud
    let periodDate: string;
    let periodType: '1-15' | '16-31';
    let isLastDay = false;
    let daysRemaining = 0;

    if (todayDay >= 16 && todayDay <= 18) {
      // Ventana P1 (16-18)
      periodDate = `${todayYear}-${String(todayMonth).padStart(2, '0')}-15`;
      periodType = '1-15';
      isLastDay = todayDay === 18;
      daysRemaining = 19 - todayDay; // 18 -> 1 día, 17 -> 2 días, 16 -> 3 días
    } else if (todayDay >= 1 && todayDay <= 3) {
      // Ventana P2 (1-3)
      const previousMonth = todayMonth === 1 ? 12 : todayMonth - 1;
      const previousYear = todayMonth === 1 ? todayYear - 1 : todayYear;
      periodDate = `${previousYear}-${String(previousMonth).padStart(2, '0')}-31`;
      periodType = '16-31';
      isLastDay = todayDay === 3;
      daysRemaining = 4 - todayDay; // 3 -> 1 día, 2 -> 2 días, 1 -> 3 días
    } else {
      // No estamos en una ventana de solicitud
      return NextResponse.json({
        success: true,
        message: 'No es día de ventana de solicitud de ahorro',
        skipped: true
      });
    }

    // Obtener todas las modelos activas
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'modelo')
      .eq('active', true);

    if (modelsError) {
      console.error('❌ [SAVINGS-REMINDERS] Error obteniendo modelos:', modelsError);
      return NextResponse.json({ success: false, error: modelsError.message }, { status: 500 });
    }

    if (!models || models.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay modelos activas',
        notified: 0
      });
    }

    let notified = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Para cada modelo, verificar si ya solicitó ahorro para este período
    for (const model of models) {
      try {
        // Verificar si ya tiene una solicitud para este período
        const { data: existingSavings, error: savingsError } = await supabase
          .from('model_savings')
          .select('id, estado')
          .eq('model_id', model.id)
          .eq('period_date', periodDate)
          .eq('period_type', periodType)
          .in('estado', ['pendiente', 'aprobado']);

        if (savingsError) {
          console.error(`❌ [SAVINGS-REMINDERS] Error verificando ahorros para ${model.name}:`, savingsError);
          errors.push(`${model.name}: ${savingsError.message}`);
          continue;
        }

        // Si ya tiene una solicitud (pendiente o aprobada), no enviar recordatorio
        if (existingSavings && existingSavings.length > 0) {
          skipped++;
          continue;
        }

        // Verificar si tiene NETO A PAGAR para este período
        const netoData = await getNetoPagarForPeriod(model.id, periodDate, periodType);
        
        if (!netoData.success || netoData.neto_pagar <= 0) {
          // No tiene fondos para ahorrar, no enviar recordatorio
          skipped++;
          continue;
        }

        // Preparar mensaje según el día
        let message = '';
        if (isLastDay) {
          message = `⏰ ${model.name}, ¡último día para solicitar ahorro del período ${periodType === '1-15' ? 'P1' : 'P2'}! Tienes hasta hoy para solicitar que se guarde parte de tu NETO A PAGAR. [LINK:Solicitar ahora|/admin/model/finanzas/ahorro/solicitar]`;
        } else {
          message = `💰 ${model.name}, recuerda que tienes ${daysRemaining} día${daysRemaining > 1 ? 's' : ''} para solicitar ahorro del período ${periodType === '1-15' ? 'P1' : 'P2'}. Puedes ahorrar hasta el 90% de tu NETO A PAGAR. [LINK:Solicitar ahora|/admin/model/finanzas/ahorro/solicitar]`;
        }

        // Enviar notificación
        await sendBotNotification(
          model.id,
          'savings_window_reminder',
          message
        );

        notified++;
      } catch (error: any) {
        console.error(`❌ [SAVINGS-REMINDERS] Error procesando modelo ${model.name}:`, error);
        errors.push(`${model.name}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recordatorios enviados: ${notified}, omitidos: ${skipped}`,
      notified,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      period: {
        date: periodDate,
        type: periodType,
        isLastDay,
        daysRemaining
      }
    });

  } catch (error: any) {
    console.error('❌ [SAVINGS-REMINDERS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
