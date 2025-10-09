import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔧 [DEBUG] Agregando columna groups a la tabla users...');

    // 1. Agregar la columna groups como array de UUIDs
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS groups UUID[] DEFAULT '{}';
      `
    });

    if (alterError) {
      console.error('Error agregando columna:', alterError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error agregando columna groups',
          details: alterError 
        },
        { status: 500 }
      );
    }

    // 2. Crear índice para mejorar performance
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_users_groups ON users USING GIN (groups);
      `
    });

    if (indexError) {
      console.warn('Warning creando índice:', indexError);
    }

    // 3. Verificar que la columna se creó correctamente
    const { data: columnInfo, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'users')
      .eq('column_name', 'groups');

    // 4. Mostrar algunos usuarios para verificar
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role, groups')
      .eq('role', 'modelo')
      .limit(3);

    return NextResponse.json({
      success: true,
      message: 'Columna groups agregada exitosamente',
      results: {
        columnInfo: columnInfo || [],
        users: users || [],
        errors: {
          columnError,
          usersError
        }
      }
    });

  } catch (error) {
    console.error('Error en fix-users-groups:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error 
      },
      { status: 500 }
    );
  }
}
