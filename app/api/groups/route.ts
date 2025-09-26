// =====================================================
// 🏢 API MODERNA DE GESTIÓN DE GRUPOS
// =====================================================
// Endpoint moderno para CRUD de grupos con Supabase
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, hasPermission } from '../../../lib/auth-modern';

// =====================================================
// 📋 GET - Obtener grupos
// =====================================================

export async function GET(request: NextRequest) {
  try {
    console.log('🏢 [API] Obteniendo lista de grupos');
    
    // Verificar autenticación
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Obtener grupos de la organización (consulta simplificada)
    const { data: groups, error } = await supabase
      .from('groups')
      .select(`
        id,
        name,
        description,
        is_active,
        created_at
      `)
      .eq('organization_id', currentUser.organization_id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ [API] Error obteniendo grupos:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo grupos' },
        { status: 500 }
      );
    }

    // Obtener miembros por separado para cada grupo
    const formattedGroups = await Promise.all(
      (groups || []).map(async (group) => {
        // Obtener miembros del grupo
        const { data: groupMembers } = await supabase
          .from('user_groups')
          .select(`
            user_id,
            is_manager,
            user_profiles!inner(
              id,
              name,
              role
            )
          `)
          .eq('group_id', group.id);

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          is_active: group.is_active,
          created_at: group.created_at,
          members: groupMembers?.map((gm: any) => ({
            user_id: gm.user_id,
            name: gm.user_profiles.name,
            role: gm.user_profiles.role,
            is_manager: gm.is_manager
          })) || []
        };
      })
    );

    console.log('✅ [API] Grupos obtenidos:', formattedGroups.length);

    return NextResponse.json({
      success: true,
      groups: formattedGroups
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// =====================================================
// ➕ POST - Crear grupo
// =====================================================

export async function POST(request: NextRequest) {
  try {
    console.log('➕ [API] Creando nuevo grupo');
    
    // Verificar autenticación
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar permisos
    if (!hasPermission(currentUser, 'admin.groups.create')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para crear grupos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    // Validar datos
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Nombre del grupo es requerido' },
        { status: 400 }
      );
    }

    // Crear grupo
    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        organization_id: currentUser.organization_id,
        name,
        description: description || '',
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Error creando grupo:', error);
      return NextResponse.json(
        { success: false, error: 'Error creando grupo' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Grupo creado exitosamente:', {
      id: group.id,
      name: group.name
    });

    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        is_active: group.is_active,
        created_at: group.created_at
      }
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// =====================================================
// 🚫 MÉTODOS NO PERMITIDOS
// =====================================================

export async function PUT() {
  return NextResponse.json(
    { error: 'Método no permitido' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Método no permitido' },
    { status: 405 }
  );
}
