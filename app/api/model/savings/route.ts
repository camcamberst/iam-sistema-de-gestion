import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isWithinSavingsWindow, getNetoPagarForPeriod, getTotalSavingsBalance } from '@/lib/savings/savings-utils';
import { getPeriodToClose } from '@/utils/period-closure-dates';
import { sendBotNotification } from '@/lib/chat/bot-notifications';

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
 * GET: Obtener ahorros de la modelo autenticada
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const includeBalance = searchParams.get('includeBalance') === 'true';

    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que el usuario es la modelo o admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';
    const targetModelId = modelId || user.id;

    // Si no es admin y no es su propio ID, denegar
    if (!isAdmin && user.id !== targetModelId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Obtener ahorros
    let query = supabase
      .from('model_savings')
      .select('*')
      .eq('model_id', targetModelId)
      .order('created_at', { ascending: false });

    const { data: savings, error: savingsError } = await query;

    if (savingsError) {
      console.error('❌ [SAVINGS] Error obteniendo ahorros:', savingsError);
      return NextResponse.json({ success: false, error: savingsError.message }, { status: 500 });
    }

    // Si se solicita, incluir balance
    let balance = null;
    if (includeBalance) {
      const balanceData = await getTotalSavingsBalance(targetModelId);
      if (balanceData.success) {
        balance = balanceData;
      }
    }

    return NextResponse.json({
      success: true,
      savings: savings || [],
      balance
    });

  } catch (error: any) {
    console.error('❌ [SAVINGS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST: Crear solicitud de ahorro
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      period_date,
      period_type,
      monto_ahorrado,
      porcentaje_ahorrado,
      tipo_solicitud // 'monto' o 'porcentaje'
    } = body;

    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const modelId = user.id;

    // Validaciones básicas
    if (!period_date || !period_type || !tipo_solicitud) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    if (tipo_solicitud === 'monto' && !monto_ahorrado) {
      return NextResponse.json({ success: false, error: 'Monto requerido' }, { status: 400 });
    }

    if (tipo_solicitud === 'porcentaje' && !porcentaje_ahorrado) {
      return NextResponse.json({ success: false, error: 'Porcentaje requerido' }, { status: 400 });
    }

    // Validar ventana de tiempo
    const windowCheck = isWithinSavingsWindow(period_date, period_type as '1-15' | '16-31');
    if (!windowCheck.isWithin) {
      return NextResponse.json({
        success: false,
        error: windowCheck.reason || 'Fuera de la ventana de tiempo para solicitar ahorro',
        windowInfo: {
          windowStart: windowCheck.windowStart,
          windowEnd: windowCheck.windowEnd
        }
      }, { status: 400 });
    }

    // Obtener NETO A PAGAR del período
    const netoData = await getNetoPagarForPeriod(modelId, period_date, period_type as '1-15' | '16-31');
    
    if (!netoData.success || netoData.neto_pagar <= 0) {
      return NextResponse.json({
        success: false,
        error: 'No tienes fondos disponibles para ahorrar en este período. El NETO A PAGAR es 0 o negativo.'
      }, { status: 400 });
    }

    // Calcular monto y porcentaje según el tipo de solicitud
    let montoFinal: number;
    let porcentajeFinal: number;

    if (tipo_solicitud === 'monto') {
      montoFinal = parseFloat(String(monto_ahorrado));
      porcentajeFinal = (montoFinal / netoData.neto_pagar) * 100;
    } else {
      porcentajeFinal = parseFloat(String(porcentaje_ahorrado));
      montoFinal = (netoData.neto_pagar * porcentajeFinal) / 100;
    }

    // Validar límites
    const MIN_MONTO = 50000;
    const MAX_PORCENTAJE = 90;

    if (montoFinal < MIN_MONTO) {
      return NextResponse.json({
        success: false,
        error: `El monto mínimo de ahorro es $${MIN_MONTO.toLocaleString('es-CO')} COP`
      }, { status: 400 });
    }

    if (porcentajeFinal > MAX_PORCENTAJE) {
      return NextResponse.json({
        success: false,
        error: `El porcentaje máximo de ahorro es ${MAX_PORCENTAJE}%`
      }, { status: 400 });
    }

    if (montoFinal > netoData.neto_pagar) {
      return NextResponse.json({
        success: false,
        error: `El monto solicitado ($${montoFinal.toLocaleString('es-CO')}) excede el NETO A PAGAR disponible ($${netoData.neto_pagar.toLocaleString('es-CO')})`
      }, { status: 400 });
    }

    // Verificar si ya existe una solicitud para este período
    const { data: existing } = await supabase
      .from('model_savings')
      .select('id, estado')
      .eq('model_id', modelId)
      .eq('period_date', period_date)
      .eq('period_type', period_type)
      .maybeSingle();

    if (existing) {
      // Si está pendiente, permitir actualización
      if (existing.estado === 'pendiente') {
        const { data: updated, error: updateError } = await supabase
          .from('model_savings')
          .update({
            monto_ahorrado: montoFinal,
            porcentaje_ahorrado: porcentajeFinal,
            tipo_solicitud,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ [SAVINGS] Error actualizando solicitud:', updateError);
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          savings: updated,
          message: 'Solicitud de ahorro actualizada'
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Ya existe una solicitud de ahorro para este período que no está pendiente'
        }, { status: 400 });
      }
    }

    // Crear nueva solicitud
    const { data: newSavings, error: createError } = await supabase
      .from('model_savings')
      .insert({
        model_id: modelId,
        period_date,
        period_type,
        neto_pagar_base: netoData.neto_pagar,
        monto_ahorrado: montoFinal,
        porcentaje_ahorrado: porcentajeFinal,
        tipo_solicitud,
        estado: 'pendiente'
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ [SAVINGS] Error creando solicitud:', createError);
      return NextResponse.json({ success: false, error: createError.message }, { status: 500 });
    }

    // Notificar a admins (usando AIM Botty)
    try {
      const { data: modelUser } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', modelId)
        .single();

      // Obtener admins relevantes (misma lógica que anticipos)
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', modelId);

      const groupIds = userGroups?.map(g => g.group_id) || [];
      let adminIds: string[] = [];

      if (groupIds.length > 0) {
        const { data: groupAdmins } = await supabase
          .from('user_groups')
          .select('user_id, users!inner(role)')
          .in('group_id', groupIds)
          .eq('users.role', 'admin');

        adminIds = groupAdmins?.map((ga: any) => ga.user_id).filter((id): id is string => !!id) || [];
      }

      // También incluir super_admins
      const { data: superAdmins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'super_admin')
        .eq('is_active', true);

      const superAdminIds = superAdmins?.map(u => u.id).filter((id): id is string => !!id) || [];
      const allAdminIds = Array.from(new Set([...adminIds, ...superAdminIds]));

      // Notificar a cada admin
      for (const adminId of allAdminIds) {
        await sendBotNotification(
          adminId,
          'savings_request',
          `💰 Nueva solicitud de ahorro de ${modelUser?.name || 'Modelo'}: $${montoFinal.toLocaleString('es-CO')} COP (${porcentajeFinal.toFixed(2)}% del NETO A PAGAR)`
        );
      }
    } catch (notifError) {
      console.error('❌ [SAVINGS] Error enviando notificaciones:', notifError);
      // No fallar la solicitud por error de notificación
    }

    return NextResponse.json({
      success: true,
      savings: newSavings,
      message: 'Solicitud de ahorro creada exitosamente. Espera la aprobación del administrador.'
    });

  } catch (error: any) {
    console.error('❌ [SAVINGS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
