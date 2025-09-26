// =====================================================
// 🚪 API MODERNA DE LOGOUT
// =====================================================
// Endpoint moderno para logout con Supabase Auth
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { modernLogout } from '../../../../lib/auth-modern';

export async function POST(request: NextRequest) {
  try {
    console.log('🚪 [API] Iniciando logout moderno via API');
    
    // Logout moderno con Supabase
    await modernLogout();

    console.log('✅ [API] Logout exitoso');

    return NextResponse.json({
      success: true,
      message: 'Logout exitoso'
    });

  } catch (error) {
    console.error('❌ [API] Error en logout:', error);
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
