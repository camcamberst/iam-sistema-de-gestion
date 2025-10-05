import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener configuración de calculadora para modelo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Compatibilidad: aceptar userId (legado) o modelId (nuevo)
  const legacyUserId = searchParams.get('userId');
  const modelIdParam = searchParams.get('modelId');
  const effectiveModelId = modelIdParam || legacyUserId;

  if (!effectiveModelId) {
    return NextResponse.json({ success: false, error: 'modelId o userId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [CONFIG-V2] Loading config for modelId:', effectiveModelId, {
      via: modelIdParam ? 'modelId' : 'userId-legacy'
    });

    // 1. Obtener configuración de la modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', effectiveModelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Error al obtener configuración:', configError);
      return NextResponse.json({ success: false, error: configError.message }, { status: 500 });
    }

    // 2. Si no hay configuración, retornar vacío
    if (!config) {
      console.log('🔍 [CONFIG-V2] No config found for modelId:', effectiveModelId);
      return NextResponse.json({
        success: true,
        config: {
          model_id: effectiveModelId,
          active: false,
          platforms: []
        }
      });
    }

    // 3. Obtener plataformas habilitadas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config.enabled_platforms)
      .eq('active', true)
      .order('name');

    if (platformsError) {
      console.error('Error al obtener plataformas:', platformsError);
      return NextResponse.json({ success: false, error: platformsError.message }, { status: 500 });
    }

    // 4. Formatear respuesta
    console.log('🔍 [CONFIG-V2] Raw config data:', {
      percentage_override: config.percentage_override,
      group_percentage: config.group_percentage,
      min_quota_override: config.min_quota_override,
      group_min_quota: config.group_min_quota
    });
    
    // DEBUG PROFUNDO: Verificar cada plataforma
    console.log('🔍 [CONFIG-V2] DEBUG - Platform mapping:', platforms.map(platform => ({
      id: platform.id,
      name: platform.name,
      percentage_override: config.percentage_override,
      group_percentage: config.group_percentage,
      final_group_percentage: config.group_percentage
    })));
    
    const result = {
      model_id: effectiveModelId,
      active: true,
      platforms: platforms.map(platform => ({
        id: platform.id,
        name: platform.name,
        description: platform.description,
        currency: platform.currency,
        token_rate: platform.token_rate,
        discount_factor: platform.discount_factor,
        tax_rate: platform.tax_rate,
        direct_payout: platform.direct_payout,
        enabled: true,
        percentage_override: config.percentage_override,
        group_percentage: config.group_percentage, // NO fallback aquí
        min_quota_override: config.min_quota_override,
        group_min_quota: config.group_min_quota
      }))
    };

    console.log('🔍 [CONFIG-V2] Returning config:', result);
    return NextResponse.json({ success: true, config: result });

  } catch (error: any) {
    console.error('❌ [CONFIG-V2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// POST: Crear/actualizar configuración de calculadora
export async function POST(request: NextRequest) {
  try {
    const { modelId, adminId, groupId, enabledPlatforms, percentageOverride, minQuotaOverride, groupPercentage, groupMinQuota } = await request.json();

    if (!modelId || !adminId || !groupId) {
      return NextResponse.json({ success: false, error: 'modelId, adminId y groupId son requeridos' }, { status: 400 });
    }

    // 1. Verificar que el admin existe
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminError) {
      console.error('Error al obtener admin:', adminError);
      return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
    }

    // 2. Verificar permisos
    const isSuperAdmin = adminUser.role === 'super_admin';
    const isAdmin = adminUser.role === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ success: false, error: 'No tienes permisos para configurar esta modelo' }, { status: 403 });
    }

    // 3. Desactivar configuración anterior si existe
    await supabase
      .from('calculator_config')
      .update({ active: false })
      .eq('model_id', modelId);

    // 4. Crear nueva configuración
    const { data, error } = await supabase
      .from('calculator_config')
      .insert({
        model_id: modelId,
        admin_id: adminId,
        group_id: groupId,
        enabled_platforms: enabledPlatforms || [],
        percentage_override: percentageOverride || null,
        min_quota_override: minQuotaOverride || null,
        group_percentage: groupPercentage !== undefined ? groupPercentage : null,
        group_min_quota: groupMinQuota || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear configuración:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('🔍 [CONFIG-V2] Created config:', data);
    return NextResponse.json({ success: true, config: data });

  } catch (error: any) {
    console.error('❌ [CONFIG-V2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
