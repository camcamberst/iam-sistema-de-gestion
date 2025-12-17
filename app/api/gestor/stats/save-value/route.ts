import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/gestor/stats/save-value
 * 
 * Guarda o actualiza un valor oficial en bruto ingresado por el gestor
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Verificar autenticación
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
        error: 'No autenticado'
      }, { status: 401 });
    }

    // Verificar que el usuario es gestor
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({
        success: false,
        error: 'Error verificando permisos'
      }, { status: 500 });
    }

    if (userData.role !== 'gestor' && userData.role !== 'admin' && userData.role !== 'super_admin') {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Solo gestores pueden guardar valores'
      }, { status: 403 });
    }

    const body = await request.json();
    const { modelId, platformId, periodDate, periodType, value, groupId } = body;

    // Validar parámetros requeridos
    if (!modelId || !platformId || !periodDate || !periodType || value === undefined || !groupId) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros requeridos: modelId, platformId, periodDate, periodType, value, groupId'
      }, { status: 400 });
    }

    // Validar que el valor sea numérico
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
      return NextResponse.json({
        success: false,
        error: 'El valor debe ser numérico'
      }, { status: 400 });
    }

    // Validar que el modelo pertenezca al grupo
    const { data: userGroup, error: userGroupError } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', modelId)
      .eq('group_id', groupId)
      .single();

    if (userGroupError || !userGroup) {
      return NextResponse.json({
        success: false,
        error: 'El modelo no pertenece al grupo especificado'
      }, { status: 400 });
    }

    // Upsert: insertar o actualizar
    const { data: saved, error: saveError } = await supabase
      .from('gestor_stats_values')
      .upsert({
        model_id: modelId,
        group_id: groupId,
        platform_id: platformId,
        period_date: periodDate,
        period_type: periodType,
        value: numericValue,
        registrado_por: user.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'model_id,platform_id,period_date,period_type'
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ [SAVE-VALUE] Error guardando valor:', saveError);
      return NextResponse.json({
        success: false,
        error: 'Error guardando valor',
        details: saveError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Valor guardado exitosamente',
      data: saved
    });

  } catch (error: any) {
    console.error('❌ [SAVE-VALUE] Error inesperado:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}

