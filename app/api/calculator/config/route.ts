import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener configuración de calculadora para una modelo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId es requerido' }, { status: 400 });
  }

  try {
    // Obtener configuración de la modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select(`
        *,
        model:users!calculator_config_model_id_fkey(id, email, name),
        admin:users!calculator_config_admin_id_fkey(id, email, name),
        group:groups(id, name)
      `)
      .eq('model_id', userId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Error al obtener configuración:', configError);
      return NextResponse.json({ success: false, error: configError.message }, { status: 500 });
    }

    // Obtener plataformas disponibles
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .eq('active', true)
      .order('name');

    if (platformsError) {
      console.error('Error al obtener plataformas:', platformsError);
      return NextResponse.json({ success: false, error: platformsError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        config: config || null,
        platforms: platforms || []
      }
    });

  } catch (error: any) {
    console.error('Error en /api/calculator/config:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Crear/actualizar configuración de calculadora
export async function POST(request: NextRequest) {
  try {
    const { modelId, adminId, groupId, enabledPlatforms, percentageOverride, minQuotaOverride, groupPercentage, groupMinQuota } = await request.json();

    if (!modelId || !adminId || !groupId) {
      return NextResponse.json({ success: false, error: 'modelId, adminId y groupId son requeridos' }, { status: 400 });
    }

    // Verificar que el admin existe (simplificado)
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminError) {
      console.error('Error al obtener admin:', adminError);
      return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
    }

    // Verificar permisos (simplificado para testing)
    const isSuperAdmin = adminUser.role === 'super_admin';
    const isAdmin = adminUser.role === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ success: false, error: 'No tienes permisos para configurar esta modelo' }, { status: 403 });
    }

    // Desactivar configuración anterior si existe
    await supabase
      .from('calculator_config')
      .update({ active: false })
      .eq('model_id', modelId);

    // Crear nueva configuración
    const { data, error } = await supabase
      .from('calculator_config')
      .insert({
        model_id: modelId,
        admin_id: adminId,
        group_id: groupId,
        enabled_platforms: enabledPlatforms || [],
        percentage_override: percentageOverride || null,
        min_quota_override: minQuotaOverride || null,
        group_percentage: groupPercentage || null,
        group_min_quota: groupMinQuota || null,
        active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear configuración:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Error en /api/calculator/config POST:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
