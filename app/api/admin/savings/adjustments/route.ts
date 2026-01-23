import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
 * POST: Crear ajuste manual de ahorro
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      model_id,
      savings_id, // Opcional: si el ajuste es sobre una solicitud específica
      tipo_ajuste, // 'correccion', 'bono', 'deduccion', 'otro'
      concepto,
      monto, // Positivo (suma) o negativo (resta)
      comentarios,
      admin_id
    } = body;

    // Verificar autenticación y rol
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que es admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Validaciones
    if (!model_id || !tipo_ajuste || !concepto || monto === undefined) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    if (!['correccion', 'bono', 'deduccion', 'otro'].includes(tipo_ajuste)) {
      return NextResponse.json({ success: false, error: 'Tipo de ajuste inválido' }, { status: 400 });
    }

    const montoNum = parseFloat(String(monto));
    if (isNaN(montoNum) || montoNum === 0) {
      return NextResponse.json({ success: false, error: 'El monto debe ser diferente de 0' }, { status: 400 });
    }

    // Crear ajuste
    const { data: newAdjustment, error: createError } = await supabase
      .from('savings_adjustments')
      .insert({
        model_id,
        savings_id: savings_id || null,
        tipo_ajuste,
        concepto,
        monto: montoNum,
        comentarios,
        created_by: admin_id || user.id
      })
      .select(`
        *,
        model:users!savings_adjustments_model_id_fkey(id, name, email),
        admin:users!savings_adjustments_created_by_fkey(id, name)
      `)
      .single();

    if (createError) {
      console.error('❌ [ADMIN-ADJUSTMENTS] Error creando ajuste:', createError);
      return NextResponse.json({ success: false, error: createError.message }, { status: 500 });
    }

    // Notificar a la modelo
    try {
      const modelId = newAdjustment.model_id;
      const montoFormatted = montoNum > 0 
        ? `+$${Math.abs(montoNum).toLocaleString('es-CO')}` 
        : `-$${Math.abs(montoNum).toLocaleString('es-CO')}`;

      await sendBotNotification(
        modelId,
        'savings_adjustment',
        `🔧 Se ha realizado un ajuste en tu ahorro: ${montoFormatted} COP. Concepto: ${concepto}`
      );
    } catch (notifError) {
      console.error('❌ [ADMIN-ADJUSTMENTS] Error enviando notificación:', notifError);
    }

    return NextResponse.json({
      success: true,
      adjustment: newAdjustment,
      message: 'Ajuste creado exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-ADJUSTMENTS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET: Obtener ajustes de una modelo
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    // Verificar autenticación y rol
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que es admin o la propia modelo
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';
    const targetModelId = modelId || user.id;

    if (!isAdmin && user.id !== targetModelId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    if (!targetModelId) {
      return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
    }

    // Obtener ajustes
    const { data: adjustments, error: adjustmentsError } = await supabase
      .from('savings_adjustments')
      .select(`
        *,
        admin:users!savings_adjustments_created_by_fkey(id, name)
      `)
      .eq('model_id', targetModelId)
      .order('created_at', { ascending: false });

    if (adjustmentsError) {
      console.error('❌ [ADMIN-ADJUSTMENTS] Error obteniendo ajustes:', adjustmentsError);
      return NextResponse.json({ success: false, error: adjustmentsError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      adjustments: adjustments || []
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-ADJUSTMENTS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
