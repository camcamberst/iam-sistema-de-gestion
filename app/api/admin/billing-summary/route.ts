import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

// Usar service role key para bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener resumen de facturación por sede
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sedeId = searchParams.get('sedeId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();
  const adminId = searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'adminId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [BILLING-SUMMARY] Obteniendo resumen:', { sedeId, periodDate, adminId });

    // 1. Verificar permisos del admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', adminId)
      .single();

    if (adminError) {
      console.error('❌ [BILLING-SUMMARY] Error al obtener admin:', adminError);
      return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
    }

    const isSuperAdmin = adminUser.role === 'super_admin';
    const isAdmin = adminUser.role === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ success: false, error: 'No tienes permisos para ver este resumen' }, { status: 403 });
    }

    // 2. Obtener modelos según permisos
    let modelsQuery = supabase
      .from('users')
      .select('id, email, name, organization_id')
      .eq('role', 'modelo')
      .eq('is_active', true);

    // Si es admin (no super_admin), filtrar por su organización
    if (isAdmin && !isSuperAdmin) {
      modelsQuery = modelsQuery.eq('organization_id', adminUser.organization_id);
    }

    // Si se especifica una sede específica, filtrar por ella
    if (sedeId) {
      modelsQuery = modelsQuery.eq('organization_id', sedeId);
    }

    const { data: models, error: modelsError } = await modelsQuery;

    if (modelsError) {
      console.error('❌ [BILLING-SUMMARY] Error al obtener modelos:', modelsError);
      return NextResponse.json({ success: false, error: 'Error al obtener modelos' }, { status: 500 });
    }

    if (!models || models.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: [],
        summary: {
          totalModels: 0,
          totalUsdBruto: 0,
          totalUsdModelo: 0,
          totalUsdSede: 0,
          totalCopModelo: 0,
          totalCopSede: 0
        },
        periodDate
      });
    }

    const modelIds = models.map(m => m.id);

    // 3. Obtener totales de calculadora para el período
    const { data: totals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .in('model_id', modelIds)
      .eq('period_date', periodDate);

    if (totalsError) {
      console.error('❌ [BILLING-SUMMARY] Error al obtener totales:', totalsError);
      return NextResponse.json({ success: false, error: 'Error al obtener totales' }, { status: 500 });
    }

    // 4. Obtener tasa USD/COP actual
    const { data: rates, error: ratesError } = await supabase
      .from('rates')
      .select('usd_cop')
      .eq('active', true)
      .single();

    if (ratesError) {
      console.error('❌ [BILLING-SUMMARY] Error al obtener tasas:', ratesError);
      return NextResponse.json({ success: false, error: 'Error al obtener tasas de cambio' }, { status: 500 });
    }

    const usdCopRate = rates?.usd_cop || 3900;

    // 5. Consolidar datos por modelo
    const billingData = models.map(model => {
      const modelTotals = totals?.find(t => t.model_id === model.id);
      
      if (!modelTotals) {
        // Si no hay totales, retornar ceros
        return {
          modelId: model.id,
          email: model.email.split('@')[0], // Solo parte antes del '@'
          name: model.name,
          usdBruto: 0,
          usdModelo: 0,
          usdSede: 0,
          copModelo: 0,
          copSede: 0
        };
      }

      const usdBruto = modelTotals.total_usd_bruto || 0;
      const usdModelo = modelTotals.total_usd_modelo || 0;
      const usdSede = usdBruto - usdModelo; // USD Sede = USD Bruto - USD Modelo
      const copModelo = usdModelo * usdCopRate;
      const copSede = usdSede * usdCopRate;

      return {
        modelId: model.id,
        email: model.email.split('@')[0], // Solo parte antes del '@'
        name: model.name,
        usdBruto,
        usdModelo,
        usdSede,
        copModelo,
        copSede
      };
    });

    // 6. Calcular totales generales
    const summary = billingData.reduce((acc, model) => ({
      totalModels: acc.totalModels + 1,
      totalUsdBruto: acc.totalUsdBruto + model.usdBruto,
      totalUsdModelo: acc.totalUsdModelo + model.usdModelo,
      totalUsdSede: acc.totalUsdSede + model.usdSede,
      totalCopModelo: acc.totalCopModelo + model.copModelo,
      totalCopSede: acc.totalCopSede + model.copSede
    }), {
      totalModels: 0,
      totalUsdBruto: 0,
      totalUsdModelo: 0,
      totalUsdSede: 0,
      totalCopModelo: 0,
      totalCopSede: 0
    });

    console.log('✅ [BILLING-SUMMARY] Resumen generado:', { 
      models: billingData.length, 
      summary 
    });

    return NextResponse.json({
      success: true,
      data: billingData,
      summary,
      periodDate,
      sedeId: sedeId || 'all',
      adminRole: adminUser.role
    });

  } catch (error: any) {
    console.error('❌ [BILLING-SUMMARY] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
