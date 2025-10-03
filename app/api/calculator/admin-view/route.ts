import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener datos de calculadora de un modelo específico para admin view
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const adminId = searchParams.get('adminId');

    console.log('🔍 [ADMIN-VIEW] GET request:', { modelId, adminId });

    if (!modelId || !adminId) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId y adminId son requeridos' 
      }, { status: 400 });
    }

    // 1. Verificar que el admin tiene permisos para ver este modelo
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role, groups:user_groups(group_id)')
      .eq('id', adminId)
      .single();

    if (adminError) {
      console.error('❌ [ADMIN-VIEW] Error al obtener admin:', adminError);
      return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
    }

    const isSuperAdmin = adminUser.role === 'super_admin';
    const isAdmin = adminUser.role === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'No tienes permisos para acceder a esta función' 
      }, { status: 403 });
    }

    // 2. Obtener información del modelo
    const { data: model, error: modelError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        groups:user_groups(
          group_id,
          group:groups(id, name)
        )
      `)
      .eq('id', modelId)
      .eq('role', 'modelo')
      .single();

    if (modelError) {
      console.error('❌ [ADMIN-VIEW] Error al obtener modelo:', modelError);
      return NextResponse.json({ success: false, error: 'Modelo no encontrado' }, { status: 404 });
    }

    // 3. Verificar jerarquía: Admin solo puede ver modelos de sus grupos
    if (isAdmin && !isSuperAdmin) {
      const adminGroupIds = adminUser.groups?.map((g: any) => g.group_id) || [];
      const modelGroupIds = model.groups?.map((g: any) => g.group_id) || [];
      
      const hasAccess = modelGroupIds.some((groupId: string) => adminGroupIds.includes(groupId));
      
      if (!hasAccess) {
        return NextResponse.json({ 
          success: false, 
          error: 'No tienes permisos para ver este modelo' 
        }, { status: 403 });
      }
    }

    // 4. Obtener configuración de calculadora del modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('❌ [ADMIN-VIEW] Error al obtener configuración:', configError);
      return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
    }

    // 5. Obtener plataformas habilitadas si hay configuración
    let platforms: any[] = [];
    if (config) {
      const { data: platformData, error: platformError } = await supabase
        .from('calculator_platforms')
        .select('*')
        .in('id', config.enabled_platforms)
        .eq('active', true)
        .order('name');

      if (platformError) {
        console.error('❌ [ADMIN-VIEW] Error al obtener plataformas:', platformError);
        return NextResponse.json({ success: false, error: 'Error al obtener plataformas' }, { status: 500 });
      }

      // Formatear plataformas con porcentajes y cuotas
      platforms = (platformData || []).map((platform: any) => ({
        id: platform.id,
        name: platform.name,
        description: platform.description,
        currency: platform.currency,
        token_rate: platform.token_rate,
        discount_factor: platform.discount_factor,
        tax_rate: platform.tax_rate,
        direct_payout: platform.direct_payout,
        percentage: config.percentage_override || config.group_percentage || 80,
        min_quota: config.min_quota_override || config.group_min_quota || 470
      }));
    }

    // 6. Obtener valores actuales del modelo (solo lectura)
    const { data: modelValues, error: valuesError } = await supabase
      .from('model_values')
      .select(`
        platform_id,
        value,
        tokens,
        value_usd,
        platform,
        created_at,
        updated_at
      `)
      .eq('model_id', modelId)
      .order('created_at', { ascending: false });

    if (valuesError) {
      console.error('❌ [ADMIN-VIEW] Error al obtener valores:', valuesError);
      return NextResponse.json({ success: false, error: 'Error al obtener valores' }, { status: 500 });
    }

    // 7. Formatear respuesta
    const response = {
      success: true,
      model: {
        id: model.id,
        name: model.name,
        email: model.email,
        groups: model.groups?.map((g: any) => g.group) || []
      },
      config: config ? {
        id: config.id,
        active: config.active,
        enabled_platforms: config.enabled_platforms,
        percentage_override: config.percentage_override,
        min_quota_override: config.min_quota_override,
        group_percentage: config.group_percentage,
        group_min_quota: config.group_min_quota,
        created_at: config.created_at
      } : null,
      platforms: platforms.map(p => ({
        id: p.id,
        name: p.name,
        enabled: true,
        percentage: p.percentage,
        min_quota: p.min_quota,
        currency: p.currency
      })),
      values: modelValues || [],
      isConfigured: !!config
    };

    console.log('✅ [ADMIN-VIEW] Data loaded successfully:', {
      modelName: model.name,
      isConfigured: !!config,
      platformsCount: platforms.length,
      valuesCount: modelValues?.length || 0
    });

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [ADMIN-VIEW] Error general:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

