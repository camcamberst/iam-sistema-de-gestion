import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar que sea admin o super_admin
    const { data: userRow } = await supabaseServer
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userRow || (userRow.role !== 'admin' && userRow.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // 1. Obtener todos los usuarios y sus roles
    const { data: allUsers, error: usersError } = await supabaseServer
      .from('users')
      .select('id, name, email, role, created_at, updated_at')
      .order('role, name');

    if (usersError) throw usersError;

    // 2. Contar usuarios por rol
    const { data: roleCounts, error: countError } = await supabaseServer
      .from('users')
      .select('role')
      .order('role');

    if (countError) throw countError;

    // Procesar conteos
    const roleCountsMap = roleCounts.reduce((acc: any, user: any) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    // 3. Buscar usuarios modelo con diferentes variaciones
    const modelVariations = ['modelo', 'model', 'MODELO', 'Modelo', 'MODEL', 'Model'];
    const modelCounts: any = {};

    for (const variation of modelVariations) {
      const { data, error } = await supabaseServer
        .from('users')
        .select('id')
        .eq('role', variation);
      
      if (!error) {
        modelCounts[variation] = data?.length || 0;
      }
    }

    // 4. Buscar usuarios que contengan "model" en el rol
    const { data: modelLikeUsers, error: modelLikeError } = await supabaseServer
      .from('users')
      .select('id, name, email, role')
      .ilike('role', '%model%')
      .order('name');

    if (modelLikeError) throw modelLikeError;

    // 5. Verificar usuarios sin rol
    const { data: noRoleUsers, error: noRoleError } = await supabaseServer
      .from('users')
      .select('id, name, email, role')
      .or('role.is.null,role.eq.,role.eq.null')
      .order('name');

    if (noRoleError) throw noRoleError;

    return NextResponse.json({
      success: true,
      data: {
        allUsers,
        roleCounts: roleCountsMap,
        modelVariations: modelCounts,
        modelLikeUsers,
        noRoleUsers,
        summary: {
          totalUsers: allUsers?.length || 0,
          totalRoles: Object.keys(roleCountsMap).length,
          modelUsersFound: modelLikeUsers?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('Error en debug de usuarios:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
