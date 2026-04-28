// =====================================================
// 📊 API: GESTOR HISTORICAL RATES
// =====================================================
// Endpoints para gestionar rates históricas del gestor
// Estas rates SOLO afectan a períodos históricos en calculator_history
// NO afectan a rates actuales ni a períodos en curso
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

// =====================================================
// 📋 GET - Obtener rates históricas
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const periodDate = searchParams.get('periodDate');
    const periodType = searchParams.get('periodType');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    // Autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    // Verificar rol
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'Error verificando usuario' }, { status: 500 });
    }

    const allowedRoles = ['gestor', 'admin', 'super_admin', 'modelo'];
    if (!allowedRoles.includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Construir query
    let query = supabase
      .from('gestor_historical_rates')
      .select(`
        *,
        configurado_por_user:users!gestor_historical_rates_configurado_por_fkey(id, name, email),
        aplicado_por_user:users!gestor_historical_rates_aplicado_por_fkey(id, name, email),
        group:groups(id, name)
      `)
      .order('period_date', { ascending: false })
      .order('period_type', { ascending: false });

    // Filtros
    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    if (periodDate) {
      query = query.eq('period_date', periodDate);
    }

    if (periodType) {
      query = query.eq('period_type', periodType);
    }

    // Filtrar por año y mes si se proporcionan
    if (year && month) {
      const periodDateP1 = `${year}-${String(month).padStart(2, '0')}-01`;
      const periodDateP2 = `${year}-${String(month).padStart(2, '0')}-16`;
      query = query.in('period_date', [periodDateP1, periodDateP2]);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ [HISTORICAL RATES] Error obteniendo rates:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error: any) {
    console.error('❌ [HISTORICAL RATES] Error inesperado:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error inesperado' },
      { status: 500 }
    );
  }
}

// =====================================================
// ➕ POST - Crear o actualizar rates históricas
// =====================================================
export async function POST(request: NextRequest) {
  try {
    // Autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    // Verificar rol (solo gestor, admin, super_admin)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'Error verificando usuario' }, { status: 500 });
    }

    const allowedRoles = ['gestor', 'admin', 'super_admin'];
    if (!allowedRoles.includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Solo gestores, admins y super_admins pueden configurar rates históricas' }, { status: 403 });
    }

    const body = await request.json();
    const { groupId, periodDate, periodType, rateUsdCop, rateEurUsd, rateGbpUsd } = body;

    // Validaciones
    if (!groupId || !periodDate || !periodType) {
      return NextResponse.json({
        success: false,
        error: 'Faltan parámetros requeridos: groupId, periodDate, periodType'
      }, { status: 400 });
    }

    if (!rateUsdCop || !rateEurUsd || !rateGbpUsd) {
      return NextResponse.json({
        success: false,
        error: 'Faltan rates requeridas: rateUsdCop, rateEurUsd, rateGbpUsd'
      }, { status: 400 });
    }

    if (!['1-15', '16-31'].includes(periodType)) {
      return NextResponse.json({
        success: false,
        error: 'periodType debe ser "1-15" o "16-31"'
      }, { status: 400 });
    }

    // Validar que el grupo existe
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('id', groupId)
      .single();

    if (groupError || !groupData) {
      return NextResponse.json({
        success: false,
        error: 'Grupo no encontrado'
      }, { status: 404 });
    }

    // Validar que el período es histórico (no futuro)
    const periodDateObj = new Date(periodDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (periodDateObj >= today) {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden configurar rates para períodos históricos (pasados)'
      }, { status: 400 });
    }

    // Upsert (crear o actualizar)
    const { data: rateData, error: rateError } = await supabase
      .from('gestor_historical_rates')
      .upsert({
        group_id: groupId,
        period_date: periodDate,
        period_type: periodType,
        rate_usd_cop: parseFloat(rateUsdCop),
        rate_eur_usd: parseFloat(rateEurUsd),
        rate_gbp_usd: parseFloat(rateGbpUsd),
        configurado_por: user.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'group_id,period_date,period_type'
      })
      .select()
      .single();

    if (rateError) {
      console.error('❌ [HISTORICAL RATES] Error guardando rate:', rateError);
      return NextResponse.json({ success: false, error: rateError.message }, { status: 500 });
    }

    console.log('✅ [HISTORICAL RATES] Rate histórica guardada:', rateData);

    return NextResponse.json({
      success: true,
      data: rateData,
      message: 'Rates históricas guardadas correctamente'
    });

  } catch (error: any) {
    console.error('❌ [HISTORICAL RATES] Error inesperado:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error inesperado' },
      { status: 500 }
    );
  }
}

