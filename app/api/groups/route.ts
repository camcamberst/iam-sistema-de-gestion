import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAuth } from '@/lib/supabase-server';
import { addAffiliateFilter, type AuthUser } from '@/lib/affiliates/filters';

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

    // Obtener usuario completo con affiliate_studio_id para aplicar filtros
    let currentUser: AuthUser | null = null;
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
        
        if (!userError && user) {
          const { data: userData } = await supabaseServer
            .from('users')
            .select('role, affiliate_studio_id')
            .eq('id', user.id)
            .single();

          if (userData) {
            currentUser = {
              id: user.id,
              role: userData.role,
              affiliate_studio_id: userData.affiliate_studio_id
            };
          }
        }
      } catch (authError) {
        console.log('⚠️ [API] No se pudo obtener usuario completo');
      }
    }

    // Construir query según el rol
    let query = supabase
      .from('groups')
      .select('id, name, is_active, description, created_at, affiliate_studio_id');

    // Aplicar filtro de afiliado primero
    query = addAffiliateFilter(query, currentUser);

    // Si es admin (no super_admin) y no es de afiliado, filtrar por sus grupos
    if (userRole !== 'super_admin' && !currentUser?.affiliate_studio_id && userGroups.length > 0) {
      query = query.in('id', userGroups);
      console.log('🔒 [API] Filtrando grupos para admin:', userGroups);
    } else if (userRole === 'super_admin' && !currentUser?.affiliate_studio_id) {
      console.log('👑 [API] Super admin - mostrando todos los grupos');
    } else if (currentUser?.affiliate_studio_id) {
      console.log('🏢 [API] Usuario afiliado - mostrando solo grupos de su estudio');
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
    let affiliateStudioId: string | null = null;
    let userId: string | null = null;

    if (!authHeader) {
      console.error('❌ [API] No se proporcionó token de autorización');
      return NextResponse.json(
        { success: false, error: 'Token de autorización requerido' },
        { status: 401 }
      );
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
      
      if (userError || !user) {
        console.error('❌ [API] Error autenticando usuario:', userError);
        return NextResponse.json(
          { success: false, error: 'Token inválido o expirado' },
          { status: 401 }
        );
      }

      userId = user.id;
      console.log('🔍 [API] Usuario autenticado:', userId);

      const { data: userData, error: userDataError } = await supabaseServer
        .from('users')
        .select('role, affiliate_studio_id, organization_id')
        .eq('id', user.id)
        .single();

      if (userDataError || !userData) {
        console.error('❌ [API] Error obteniendo datos del usuario:', userDataError);
        return NextResponse.json(
          { success: false, error: 'Usuario no encontrado en la base de datos' },
          { status: 404 }
        );
      }

      userRole = userData.role;
      affiliateStudioId = userData.affiliate_studio_id;
      const userOrganizationId = userData.organization_id;
      
      console.log('🔍 [API] Datos del usuario:', {
        role: userRole,
        affiliate_studio_id: affiliateStudioId
      });
    } catch (authError) {
      console.error('❌ [API] Error en autenticación:', authError);
      return NextResponse.json(
        { success: false, error: 'Error de autenticación' },
        { status: 401 }
      );
    }

    // Solo super_admin o superadmin_aff pueden crear grupos
    if (userRole !== 'super_admin' && userRole !== 'superadmin_aff') {
      console.error('❌ [API] Usuario sin permisos:', userRole);
      return NextResponse.json(
        { success: false, error: 'Solo los super administradores pueden crear grupos' },
        { status: 403 }
      );
    }

    // Si es superadmin_aff, verificar que tenga affiliate_studio_id
    if (userRole === 'superadmin_aff' && !affiliateStudioId) {
      console.error('❌ [API] Superadmin_aff sin affiliate_studio_id');
      return NextResponse.json(
        { success: false, error: 'El usuario no está asociado a un estudio afiliado' },
        { status: 400 }
      );
    }

    // Obtener o crear organización por defecto si el usuario no tiene una
    let organizationId = userOrganizationId;
    
    if (!organizationId) {
      // Buscar organización por defecto o crear una
      const { data: defaultOrg, error: orgError } = await supabaseServer
        .from('organizations')
        .select('id')
        .eq('name', 'Organización Principal')
        .single();
      
      if (orgError || !defaultOrg) {
        // Crear organización por defecto si no existe
        const { data: newOrg, error: createOrgError } = await supabaseServer
          .from('organizations')
          .insert({
            name: 'Organización Principal',
            description: 'Organización principal del sistema',
            is_active: true
          })
          .select('id')
          .single();
        
        if (createOrgError || !newOrg) {
          console.error('❌ [API] Error creando organización por defecto:', createOrgError);
          return NextResponse.json(
            { success: false, error: 'Error configurando organización' },
            { status: 500 }
          );
        }
        
        organizationId = newOrg.id;
        console.log('✅ [API] Organización por defecto creada:', organizationId);
      } else {
        organizationId = defaultOrg.id;
        console.log('🔍 [API] Usando organización por defecto existente:', organizationId);
      }
    }

    // Preparar datos del grupo
    const groupData: any = {
      name: name.trim(),
      organization_id: organizationId,
      is_active: true
    };

    // Si es superadmin_aff, asignar su affiliate_studio_id
    if (userRole === 'superadmin_aff' && affiliateStudioId) {
      groupData.affiliate_studio_id = affiliateStudioId;
      console.log('🔍 [API] Superadmin_aff creando grupo, asignando affiliate_studio_id:', affiliateStudioId);
    }

    console.log('🔍 [API] Datos del grupo a crear:', groupData);

    const { data: group, error } = await supabase
      .from('groups')
      .insert(groupData)
      .select('id, name, is_active, description, created_at, affiliate_studio_id')
      .single();

    if (error) {
      console.error('❌ [API] Error creando grupo:', error);
      console.error('❌ [API] Detalles del error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Manejar error de duplicado
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Ya existe un grupo con ese nombre' },
          { status: 400 }
        );
      }
      
      // Retornar mensaje de error más descriptivo
      const errorMessage = error.message || 'Error creando grupo';
      return NextResponse.json(
        { success: false, error: errorMessage },
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
