import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET /api/rates/automation - Verificar estado de automatización
export async function GET() {
  try {
    // Por ahora, la automatización está deshabilitada manualmente
    return NextResponse.json({
      success: true,
      data: {
        enabled: false,
        message: 'Automatización de tasas deshabilitada - Solo tasas manuales'
      }
    });
  } catch (error) {
    console.error('Error checking automation status:', error);
    return NextResponse.json(
      { success: false, error: 'Error al verificar automatización' },
      { status: 500 }
    );
  }
}

// POST /api/rates/automation - Habilitar/deshabilitar automatización
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled } = body;

    // Por ahora, mantener la automatización deshabilitada
    return NextResponse.json({
      success: true,
      data: {
        enabled: false,
        message: 'Automatización deshabilitada - Solo gestión manual de tasas'
      }
    });
  } catch (error) {
    console.error('Error updating automation:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar automatización' },
      { status: 500 }
    );
  }
}
