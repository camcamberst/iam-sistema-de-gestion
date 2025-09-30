import { NextRequest, NextResponse } from 'next/server';

// GET: Endpoint simplificado para configuración de calculadora
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [CONFIG-SIMPLE] Loading config for userId:', userId);

    // Configuración por defecto para testing
    const defaultConfig = {
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
        },
        {
          platform_id: 'stripchat',
          platform_name: 'Stripchat',
          enabled: true,
          percentage_override: null,
          group_percentage: 80,
          min_quota_override: null,
          group_min_quota: 470
        },
        {
          platform_id: 'dxlive',
          platform_name: 'DX Live',
          enabled: true,
          percentage_override: null,
          group_percentage: 80,
          min_quota_override: null,
          group_min_quota: 470
        },
        {
          platform_id: 'big7',
          platform_name: 'BIG7',
          enabled: true,
          percentage_override: null,
          group_percentage: 80,
          min_quota_override: null,
          group_min_quota: 470
        }
      ]
    };

    console.log('🔍 [CONFIG-SIMPLE] Returning default config:', defaultConfig);

    return NextResponse.json({
      success: true,
      config: defaultConfig
    });

  } catch (error: any) {
    console.error('❌ [CONFIG-SIMPLE] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
