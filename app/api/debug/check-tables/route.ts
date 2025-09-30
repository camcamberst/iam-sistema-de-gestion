import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Verificar si las tablas existen
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [CHECK-TABLES] Verificando existencia de tablas...');

    // Verificar si existe calculator_config
    const { data: configTable, error: configError } = await supabase
      .from('calculator_config')
      .select('id')
      .limit(1);

    console.log('🔍 [CHECK-TABLES] calculator_config:', configTable, 'Error:', configError);

    // Verificar si existe calculator_platforms
    const { data: platformsTable, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id')
      .limit(1);

    console.log('🔍 [CHECK-TABLES] calculator_platforms:', platformsTable, 'Error:', platformsError);

    // Verificar si existe users
    const { data: usersTable, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    console.log('🔍 [CHECK-TABLES] users:', usersTable, 'Error:', usersError);

    // Verificar datos en calculator_config
    const { data: configData, error: configDataError } = await supabase
      .from('calculator_config')
      .select('*')
      .limit(5);

    console.log('🔍 [CHECK-TABLES] configData:', configData, 'Error:', configDataError);

    // Verificar datos en calculator_platforms
    const { data: platformsData, error: platformsDataError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .limit(5);

    console.log('🔍 [CHECK-TABLES] platformsData:', platformsData, 'Error:', platformsDataError);

    return NextResponse.json({
      success: true,
      tables: {
        calculator_config: {
          exists: !configError,
          error: configError?.message,
          data: configData || [],
          count: configData?.length || 0
        },
        calculator_platforms: {
          exists: !platformsError,
          error: platformsError?.message,
          data: platformsData || [],
          count: platformsData?.length || 0
        },
        users: {
          exists: !usersError,
          error: usersError?.message,
          data: usersTable || [],
          count: usersTable?.length || 0
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [CHECK-TABLES] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
