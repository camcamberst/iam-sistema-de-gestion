import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔧 [DEBUG] Verificando relación users <-> groups via user_groups...');

    // Nota: En este proyecto, NO existe `users.groups` como columna.
    // La relación se modela con la tabla relacional `user_groups` (user_id, group_id).

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('role', 'modelo')
      .limit(3);

    const userIds = (users || []).map((u) => u.id);

    const { data: mappings, error: mappingsError } = await supabase
      .from('user_groups')
      .select('user_id, group_id')
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

    const groupIds = (mappings || []).map((m) => m.group_id);

    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name')
      .in('id', groupIds.length > 0 ? groupIds : ['00000000-0000-0000-0000-000000000000']);

    return NextResponse.json({
      success: true,
      message: 'Relación correcta usando tabla relacional `user_groups`.',
      results: {
        users: users || [],
        user_groups: mappings || [],
        groups: groups || [],
        errors: {
          usersError,
          mappingsError,
          groupsError
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
