import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 [DEBUG] Revisando la estantería...');

    // 1. Ver la estructura de la tabla de usuarios
    const { data: columnInfo, error: columnError } = await supabase
      .rpc('get_table_columns', { table_name: 'users' });

    // 2. Ver algunos usuarios modelo reales
    const { data: modelos, error: modelosError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        is_active,
        groups
      `)
      .eq('role', 'modelo')
      .limit(3);

    // 3. Ver si hay alguna tabla de grupos
    const { data: tablas, error: tablasError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .like('table_name', '%group%');

    // 4. Ver la tabla groups si existe
    const { data: grupos, error: gruposError } = await supabase
      .from('groups')
      .select('*')
      .limit(5);

    return NextResponse.json({
      success: true,
      inventario: {
        estructura_usuarios: {
          error: columnError,
          data: columnInfo
        },
        modelos_reales: {
          error: modelosError,
          data: modelos,
          cantidad: modelos?.length || 0
        },
        tablas_grupos: {
          error: tablasError,
          data: tablas
        },
        grupos_disponibles: {
          error: gruposError,
          data: grupos,
          cantidad: grupos?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('Error revisando estantería:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error revisando la estantería',
        details: error 
      },
      { status: 500 }
    );
  }
}
