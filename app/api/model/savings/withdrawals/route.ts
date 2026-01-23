import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTotalSavingsBalance, canWithdrawInPeriod, calculateProcessingTime } from '@/lib/savings/savings-utils';
import { getColombiaDate, getCurrentPeriodType } from '@/utils/period-closure-dates';
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
 * GET: Obtener retiros de la modelo
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

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

    // Obtener retiros
    const { data: withdrawals, error: withdrawalsError } = await supabase
      .from('savings_withdrawals')
      .select('*')
      .eq('model_id', targetModelId)
      .order('created_at', { ascending: false });

    if (withdrawalsError) {
      console.error('❌ [WITHDRAWALS] Error obteniendo retiros:', withdrawalsError);
      return NextResponse.json({ success: false, error: withdrawalsError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      withdrawals: withdrawals || []
    });

  } catch (error: any) {
    console.error('❌ [WITHDRAWALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST: Crear solicitud de retiro
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      monto_solicitado,
      medio_pago,
      nombre_beneficiario,
      numero_telefono,
      nombre_titular,
      banco,
      banco_otro,
      tipo_cuenta,
      numero_cuenta,
      documento_titular
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
    if (!monto_solicitado || !medio_pago) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const monto = parseFloat(String(monto_solicitado));
    const MIN_RETIRO = 100000;

    if (monto < MIN_RETIRO) {
      return NextResponse.json({
        success: false,
        error: `El monto mínimo de retiro es $${MIN_RETIRO.toLocaleString('es-CO')} COP`
      }, { status: 400 });
    }

    // Obtener saldo actual
    const balance = await getTotalSavingsBalance(modelId);
    
    if (!balance.success || balance.saldo_actual < monto) {
      return NextResponse.json({
        success: false,
        error: `No tienes suficiente saldo. Saldo disponible: $${balance.saldo_actual.toLocaleString('es-CO')} COP`
      }, { status: 400 });
    }

    // Verificar si puede retirar en el período actual
    const currentDate = getColombiaDate();
    const currentPeriodType = getCurrentPeriodType();
    const periodDate = currentDate; // Usar fecha actual como referencia

    const canWithdraw = await canWithdrawInPeriod(modelId, periodDate, currentPeriodType as '1-15' | '16-31');
    
    if (!canWithdraw.canWithdraw) {
      return NextResponse.json({
        success: false,
        error: canWithdraw.reason || 'No puedes realizar más retiros en este período'
      }, { status: 400 });
    }

    // Calcular tiempo de procesamiento
    const processing = calculateProcessingTime(monto, balance.saldo_actual);
    const porcentajeRetiro = processing.porcentaje;

    // Preparar datos del retiro
    const withdrawalData: any = {
      model_id: modelId,
      monto_solicitado: monto,
      porcentaje_retiro: porcentajeRetiro,
      medio_pago,
      estado: 'pendiente',
      tiempo_procesamiento: processing.tiempo,
      fecha_aprobacion_estimada: processing.fechaEstimada.toISOString()
    };

    // Agregar datos según el medio de pago
    if (medio_pago === 'nequi' || medio_pago === 'daviplata') {
      if (!nombre_beneficiario || !numero_telefono) {
        return NextResponse.json({
          success: false,
          error: 'Nombre beneficiario y número de teléfono son requeridos para Nequi/DaviPlata'
        }, { status: 400 });
      }
      withdrawalData.nombre_beneficiario = nombre_beneficiario;
      withdrawalData.numero_telefono = numero_telefono;
    } else if (medio_pago === 'cuenta_bancaria') {
      if (!nombre_titular || !banco || !tipo_cuenta || !numero_cuenta || !documento_titular) {
        return NextResponse.json({
          success: false,
          error: 'Todos los datos bancarios son requeridos'
        }, { status: 400 });
      }
      withdrawalData.nombre_titular = nombre_titular;
      withdrawalData.banco = banco;
      withdrawalData.banco_otro = banco_otro;
      withdrawalData.tipo_cuenta = tipo_cuenta;
      withdrawalData.numero_cuenta = numero_cuenta;
      withdrawalData.documento_titular = documento_titular;
    }

    // Crear retiro
    const { data: newWithdrawal, error: createError } = await supabase
      .from('savings_withdrawals')
      .insert(withdrawalData)
      .select()
      .single();

    if (createError) {
      console.error('❌ [WITHDRAWALS] Error creando retiro:', createError);
      return NextResponse.json({ success: false, error: createError.message }, { status: 500 });
    }

    // Notificar a admins
    try {
      const { data: modelUser } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', modelId)
        .single();

      // Obtener admins relevantes
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
          'withdrawal_request',
          `💸 Nueva solicitud de retiro de ahorro de ${modelUser?.name || 'Modelo'}: $${monto.toLocaleString('es-CO')} COP (${porcentajeRetiro.toFixed(2)}% del saldo). Tiempo estimado: ${processing.tiempo}`
        );
      }
    } catch (notifError) {
      console.error('❌ [WITHDRAWALS] Error enviando notificaciones:', notifError);
    }

    return NextResponse.json({
      success: true,
      withdrawal: newWithdrawal,
      processingTime: processing.tiempo,
      estimatedDate: processing.fechaEstimada,
      message: `Solicitud de retiro creada. Tiempo estimado de procesamiento: ${processing.tiempo}`
    });

  } catch (error: any) {
    console.error('❌ [WITHDRAWALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
