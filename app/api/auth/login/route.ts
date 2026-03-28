// =====================================================
// 🔐 API MODERNA DE AUTENTICACIÓN
// =====================================================
// Endpoint moderno para login con Supabase Auth
// Eliminando credenciales hardcodeadas
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { modernLogin } from '../../../../lib/auth-modern';


export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 [API] Iniciando login moderno via API');
    
    const body = await request.json();
    const { email, password } = body;

    // Validar datos de entrada
    if (!email || !password) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Email y contraseña son requeridos' 
        },
        { status: 400 }
      );
    }

    // Autenticación moderna con Supabase
    const result = await modernLogin({ email, password });

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Error de autenticación' 
        },
        { status: 401 }
      );
    }

    console.log('✅ [API] Login exitoso:', {
      id: result.user?.id,
      email: result.user?.email,
      role: result.user?.role
    });

    // Retornar datos del usuario (sin información sensible)
    return NextResponse.json({
      success: true,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        name: result.user?.name,
        role: result.user?.role,
        organization_id: result.user?.organization_id,
        groups: result.user?.groups,
        is_active: result.user?.is_active,
        last_login: result.user?.last_login
      }
    });

  } catch (error) {
    console.error('❌ [API] Error en login:', error);
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

export async function GET() {
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
