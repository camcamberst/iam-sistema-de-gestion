// =====================================================
// 👤 API MODERNA DE SESIÓN
// =====================================================
// Endpoint moderno para obtener sesión actual
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth-modern';

export async function GET(request: NextRequest) {
  try {
    console.log('👤 [API] Obteniendo sesión actual');
    
    // Obtener usuario actual con Supabase Auth
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No hay sesión activa' 
        },
        { status: 401 }
      );
    }

    console.log('✅ [API] Sesión obtenida:', {
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Retornar datos del usuario (sin información sensible)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization_id: user.organization_id,
        groups: user.groups,
        is_active: user.is_active,
        last_login: user.last_login
      }
    });

  } catch (error) {
    console.error('❌ [API] Error obteniendo sesión:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}

// =====================================================
// 🚫 MÉTODOS NO PERMITIDOS
// =====================================================

export async function POST() {
  return NextResponse.json(
    { error: 'Método no permitido' },
    { status: 405 }
  );
}

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
