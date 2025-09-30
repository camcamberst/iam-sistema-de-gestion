import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Debug completo del flujo de calculadora
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG-CALCULATOR-FLOW] Starting complete flow debug...');

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId es requerido' }, { status: 400 });
    }

    // 1. Verificar configuración de la modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', userId)
      .eq('active', true)
      .single();

    console.log('🔍 [DEBUG-CALCULATOR-FLOW] Config for userId', userId, ':', config);
    console.log('🔍 [DEBUG-CALCULATOR-FLOW] Config error:', configError);

    // 2. Verificar todas las configuraciones
    const { data: allConfigs, error: allConfigsError } = await supabase
      .from('calculator_config')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('🔍 [DEBUG-CALCULATOR-FLOW] All configs:', allConfigs);

    // 3. Verificar plataformas disponibles
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .eq('active', true)
      .order('name');

    console.log('🔍 [DEBUG-CALCULATOR-FLOW] Platforms:', platforms);

    // 4. Verificar usuarios
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .order('role');

    console.log('🔍 [DEBUG-CALCULATOR-FLOW] Users:', users);

    // 5. Si hay configuración, verificar plataformas habilitadas
    let enabledPlatforms = [];
    if (config && config.enabled_platforms) {
      const { data: enabledPlatformsData, error: enabledPlatformsError } = await supabase
        .from('calculator_platforms')
        .select('*')
        .in('id', config.enabled_platforms)
        .eq('active', true);

      enabledPlatforms = enabledPlatformsData || [];
      console.log('🔍 [DEBUG-CALCULATOR-FLOW] Enabled platforms:', enabledPlatforms);
    }

    return NextResponse.json({
      success: true,
      debug: {
        userId,
        config: config || null,
        configError: configError?.message,
        allConfigs: allConfigs || [],
        platforms: platforms || [],
        enabledPlatforms: enabledPlatforms,
        users: users || [],
        errors: {
          configError: configError?.message,
          allConfigsError: allConfigsError?.message,
          platformsError: platformsError?.message,
          usersError: usersError?.message
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG-CALCULATOR-FLOW] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
