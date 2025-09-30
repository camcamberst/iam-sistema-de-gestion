import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Endpoint híbrido para configuración de calculadora
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [CONFIG-HYBRID] Loading config for userId:', userId);

    // Intentar obtener configuración real
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
      // Continuar con fallback
    }

    // Si hay configuración real, usarla
    if (config) {
      console.log('🔍 [CONFIG-HYBRID] Found real config:', config);
      
      // Obtener plataformas habilitadas para esta modelo
      const { data: platforms, error: platformsError } = await supabase
        .from('calculator_platforms')
        .select('*')
        .eq('active', true)
        .order('name');

      if (platformsError) {
        console.error('Error al obtener plataformas:', platformsError);
        return NextResponse.json({ success: false, error: platformsError.message }, { status: 500 });
      }

      // Filtrar solo las plataformas habilitadas para esta modelo
      const enabledPlatforms = platforms.filter(platform => 
        config.enabled_platforms && config.enabled_platforms.includes(platform.id)
      );

      const result = {
        model_id: userId,
        active: true,
        platforms: enabledPlatforms.map(platform => ({
          platform_id: platform.id,
          platform_name: platform.name,
          enabled: true,
          percentage_override: config.percentage_override,
          group_percentage: config.group_percentage || 80,
          min_quota_override: config.min_quota_override,
          group_min_quota: config.group_min_quota || 470
        }))
      };

      console.log('🔍 [CONFIG-HYBRID] Returning real config:', result);
      return NextResponse.json({ success: true, config: result });
    }

    // Fallback: configuración por defecto si no hay configuración real
    console.log('🔍 [CONFIG-HYBRID] No real config found, using fallback');
    
    const fallbackConfig = {
      model_id: userId,
      active: true,
      platforms: [
        {
          platform_id: 'chaturbate',
          platform_name: 'Chaturbate',
          enabled: true,
          percentage_override: null,
          group_percentage: 80,
          min_quota_override: null,
          group_min_quota: 470
        },
        {
          platform_id: 'myfreecams',
          platform_name: 'MyFreeCams',
          enabled: true,
          percentage_override: null,
          group_percentage: 80,
          min_quota_override: null,
          group_min_quota: 470
        }
      ]
    };

    console.log('🔍 [CONFIG-HYBRID] Returning fallback config:', fallbackConfig);
    return NextResponse.json({ success: true, config: fallbackConfig });

  } catch (error: any) {
    console.error('❌ [CONFIG-HYBRID] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
