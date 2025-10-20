import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener modelos disponibles para configurar (según jerarquía del admin)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminId = searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'adminId es requerido' }, { status: 400 });
  }

  try {
    // Obtener información del admin con sus grupos
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select(`
        role,
        groups:user_groups(
          group_id,
          group:groups(id, name)
        )
      `)
      .eq('id', adminId)
      .single();

    if (adminError) {
      console.error('Error al obtener admin:', adminError);
      return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
    }

    const isSuperAdmin = adminUser.role === 'super_admin';
    const isAdmin = adminUser.role === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ success: false, error: 'No tienes permisos para acceder a esta función' }, { status: 403 });
    }

    let modelsQuery = supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        role,
        groups:user_groups(
          group_id,
          group:groups(id, name)
        ),
        calculator_config:calculator_config!calculator_config_model_id_fkey(
          id,
          active,
          enabled_platforms,
          percentage_override,
          min_quota_override,
          group_percentage,
          group_min_quota,
          created_at
        )
      `)
      .eq('role', 'modelo');

    // Si es admin (no super admin), filtrar por sus grupos
    if (isAdmin && !isSuperAdmin) {
      const adminGroupIds = adminUser.groups?.map((g: any) => g.group_id).filter(Boolean) || [];
      
      if (adminGroupIds.length === 0) {
        return NextResponse.json({ success: true, models: [] });
      }

      // Obtener IDs de modelos que pertenecen a los grupos del admin
      const { data: modelIds, error: modelIdsError } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', adminGroupIds);

      if (modelIdsError) {
        console.error('Error al obtener IDs de modelos:', modelIdsError);
        return NextResponse.json({ success: false, error: 'Error al filtrar modelos' }, { status: 500 });
      }

      const userIds = modelIds?.map((m: any) => m.user_id) || [];
      
      if (userIds.length === 0) {
        return NextResponse.json({ success: true, models: [] });
      }

      // Filtrar modelos por IDs obtenidos
      modelsQuery = modelsQuery.in('id', userIds);
    }

    const { data: models, error: modelsError } = await modelsQuery;

    if (modelsError) {
      console.error('Error al obtener modelos:', modelsError);
      return NextResponse.json({ success: false, error: modelsError.message }, { status: 500 });
    }

    // Procesar datos para incluir configuración actual
    const processedModels = models?.map(model => {
      // Buscar configuración activa (active = true)
      const activeConfig = model.calculator_config?.find((config: any) => config.active === true);
      
      console.log(`🔍 [CONFIG CHECK] Modelo ${model.email}:`, {
        totalConfigs: model.calculator_config?.length || 0,
        activeConfig: !!activeConfig,
        configs: model.calculator_config?.map((c: any) => ({ id: c.id, active: c.active })) || []
      });
      
      return {
        id: model.id,
        email: model.email,
        name: model.name,
        role: model.role,
        groups: model.groups?.map((g: any) => g.group).filter(Boolean) || [{ id: 'default', name: 'Sin grupo asignado' }],
        hasConfig: !!activeConfig,
        currentConfig: activeConfig || null
      };
    }) || [];

    return NextResponse.json({
      success: true,
      models: processedModels
    });

  } catch (error: any) {
    console.error('Error en /api/calculator/models:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
