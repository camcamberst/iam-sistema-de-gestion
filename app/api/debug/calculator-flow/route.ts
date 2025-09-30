import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [DEBUG] Starting calculator flow debug for userId:', userId);

    // 1. Verificar si el usuario existe
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', userId)
      .single();

    if (userError) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado',
        debug: { userError: userError.message }
      });
    }

    // 2. Verificar configuración de calculadora
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', userId)
      .eq('active', true)
      .single();

    // 3. Verificar plataformas disponibles
    const { data: allPlatforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .eq('active', true)
      .order('name');

    // 4. Verificar tasas
    const { data: rates, error: ratesError } = await supabase
      .from('rates')
      .select('*')
      .is('valid_to', null)
      .order('kind');

    return NextResponse.json({
      success: true,
      debug: {
        user: user,
        hasConfig: !!config,
        config: config,
        totalPlatforms: allPlatforms?.length || 0,
        platforms: allPlatforms?.slice(0, 5) || [], // Solo primeras 5 para debug
        totalRates: rates?.length || 0,
        rates: rates,
        errors: {
          configError: configError?.message,
          platformsError: platformsError?.message,
          ratesError: ratesError?.message
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      debug: { stack: error.stack }
    });
  }
}