// =====================================================
// 🏢 API ULTRA SIMPLE DE GRUPOS - SIN AUTENTICACIÓN
// =====================================================
// Endpoint sin autenticación para testing y desarrollo
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// 📋 GET - Obtener grupos (SIN AUTENTICACIÓN)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    console.log('🏢 [API] Obteniendo lista de grupos (SIN AUTH)');
    
    // Crear cliente Supabase directo
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: groups, error } = await supabase
      .from('groups')
      .select(`
        id,
        name,
        description,
        organization_id,
        user_groups(
          user_id,
          is_manager,
          users!inner(
            id,
            name,
            email,
            role
          )
        )
      `)
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ [API] Error obteniendo grupos:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo grupos' },
        { status: 500 }
      );
    }

    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      organization_id: group.organization_id,
      members: group.user_groups.map((ug: any) => ({
        id: ug.users.id,
        name: ug.users.name,
        email: ug.users.email,
        role: ug.users.role,
        is_manager: ug.is_manager
      }))
    }));

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