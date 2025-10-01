import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Forzar renderizado dinámico
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Debug de base de datos
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Starting database verification...');

    // 1. Verificar tablas existentes
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['calculator_config', 'calculator_platforms', 'users', 'user_groups', 'groups']);

    console.log('🔍 [DEBUG] Tables found:', tables);

    // 2. Verificar calculator_platforms
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, name, currency, active')
      .limit(10);

    console.log('🔍 [DEBUG] Platforms found:', platforms);

    // 3. Verificar calculator_config
    const { data: configs, error: configsError } = await supabase
      .from('calculator_config')
      .select('*')
      .limit(10);

    console.log('🔍 [DEBUG] Configs found:', configs);

    // 4. Verificar usuarios
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .limit(10);

    console.log('🔍 [DEBUG] Users found:', users);

    // 5. Verificar configuración específica para modelo
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    let modelConfig = null;
    if (userId) {
      const { data: modelConfigData, error: modelConfigError } = await supabase
        .from('calculator_config')
        .select('*')
        .eq('model_id', userId)
        .eq('active', true)
        .single();
      
      modelConfig = modelConfigData;
      console.log('🔍 [DEBUG] Model config for userId', userId, ':', modelConfig);
    }

    return NextResponse.json({
      success: true,
      debug: {
        tables: tables || [],
        platforms: platforms || [],
        configs: configs || [],
        users: users || [],
        modelConfig: modelConfig,
        errors: {
          tablesError: tablesError?.message,
          platformsError: platformsError?.message,
          configsError: configsError?.message,
          usersError: usersError?.message
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
