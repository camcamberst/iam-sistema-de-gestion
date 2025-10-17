import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAuth } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    console.log('🏢 [API] Obteniendo grupos...');
    
    const supabase = supabaseServer;

    // Obtener información del usuario desde el token
    const authHeader = request.headers.get('authorization');
    let userRole = 'admin'; // Por defecto
    let userGroups: string[] = [];

    if (authHeader) {
      try {
        // Usar cliente centralizado para autenticación
        const token = authHeader.replace('Bearer ', '');
        
        const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
        
        if (!userError && user) {
          // Obtener información completa del usuario
          const { data: userData, error: userDataError } = await supabaseServer
            .from('users')
            .select('role, groups')
            .eq('id', user.id)
            .single();

          if (!userDataError && userData) {
            userRole = userData.role;
            userGroups = userData.groups || [];
            console.log('🔍 [API] Usuario:', { role: userRole, groups: userGroups });
          }
        }
      } catch (authError) {
        console.log('⚠️ [API] No se pudo obtener info del usuario, usando defaults');
      }
    }

    // Construir query según el rol
    let query = supabase
      .from('groups')
      .select('id, name, is_active, description, created_at');

    // Si es admin (no super_admin), filtrar por sus grupos
    if (userRole !== 'super_admin' && userGroups.length > 0) {
      query = query.in('id', userGroups);
      console.log('🔒 [API] Filtrando grupos para admin:', userGroups);
    } else if (userRole === 'super_admin') {
      console.log('👑 [API] Super admin - mostrando todos los grupos');
    }

    const { data: groups, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('❌ [API] Error obteniendo grupos:', error);
      return NextResponse.json(
        { success: false, error: `Error obteniendo grupos: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('✅ [API] Grupos obtenidos:', groups?.length || 0, 'para rol:', userRole);

    return NextResponse.json({
      success: true,
      groups: groups || [],
      userRole: userRole
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: `Error interno: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// Nueva función para manejar peticiones POST con información del usuario
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Si viene información del usuario en el body, es una petición GET disfrazada
    if (body.userRole && body.userGroups) {
      console.log('🏢 [API] Obteniendo grupos con info del usuario...');
      
      const supabase = supabaseServer;
      
      const userRole = body.userRole;
      const userGroups = body.userGroups;
      
      console.log('🔍 [API] Usuario desde body:', { role: userRole, groups: userGroups });
      
      // Construir query según el rol
      let query = supabase
        .from('groups')
        .select('id, name, is_active, description, created_at');

      // Si es admin (no super_admin), filtrar por sus grupos
      if (userRole !== 'super_admin' && userGroups.length > 0) {
        query = query.in('id', userGroups);
        console.log('🔒 [API] Filtrando grupos para admin:', userGroups);
      } else if (userRole === 'super_admin') {
        console.log('👑 [API] Super admin - mostrando todos los grupos');
      }

      const { data: groups, error } = await query.order('name', { ascending: true });

      if (error) {
        console.error('❌ [API] Error obteniendo grupos:', error);
        return NextResponse.json(
          { success: false, error: `Error obteniendo grupos: ${error.message}` },
          { status: 500 }
        );
      }

      console.log('✅ [API] Grupos obtenidos:', groups?.length || 0, 'para rol:', userRole);

      return NextResponse.json({
        success: true,
        groups: groups || [],
        userRole: userRole
      });
    }
    
    // Si no, es una petición de creación de grupo (lógica original)
    console.log('🏢 [API] Creando grupo...');
    
    const { name } = body;
    
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre del grupo es requerido' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer;

    // Obtener información del usuario para verificar permisos
    const authHeader = request.headers.get('authorization');
    let userRole = 'admin'; // Por defecto

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        
        const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
        
        if (!userError && user) {
          const { data: userData, error: userDataError } = await supabaseServer
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

          if (!userDataError && userData) {
            userRole = userData.role;
          }
        }
      } catch (authError) {
        console.log('⚠️ [API] No se pudo obtener info del usuario');
      }
    }

    // Solo super_admin puede crear grupos
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Solo los super administradores pueden crear grupos' },
        { status: 403 }
      );
    }

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name: name.trim(),
        organization_id: '00000000-0000-0000-0000-000000000000', // UUID por defecto
        is_active: true
      })
      .select('id, name, is_active, description, created_at')
      .single();

    if (error) {
      console.error('❌ [API] Error creando grupo:', error);
      
      // Manejar error de duplicado
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Ya existe un grupo con ese nombre' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: 'Error creando grupo' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Grupo creado:', group);

    return NextResponse.json({
      success: true,
      group
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}
