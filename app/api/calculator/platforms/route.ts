import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener todas las plataformas disponibles
export async function GET() {
  try {
    console.log('🔍 [API-PLATFORMS] Iniciando consulta a calculator_platforms...');
    
    const { data, error } = await supabase
      .from('calculator_platforms')
      .select('*')
      .eq('active', true)
      .order('name');

    console.log('🔍 [API-PLATFORMS] Error de Supabase:', error);
    console.log('🔍 [API-PLATFORMS] Data raw:', data);
    console.log('🔍 [API-PLATFORMS] Data type:', typeof data);
    console.log('🔍 [API-PLATFORMS] Data length:', data?.length);
    console.log('🔍 [API-PLATFORMS] Data is array:', Array.isArray(data));

    if (error) {
      console.error('❌ [API-PLATFORMS] Error al obtener plataformas:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const response = {
      success: true,
      config: {
        platforms: data || []
      }
    };

    console.log('🔍 [API-PLATFORMS] Response final:', response);
    console.log('🔍 [API-PLATFORMS] Response platforms length:', response.config.platforms?.length);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [API-PLATFORMS] Error en /api/calculator/platforms:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH: Actualizar payment_frequency de una plataforma
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { platformId, payment_frequency } = body;

    if (!platformId || !payment_frequency) {
      return NextResponse.json({ 
        success: false, 
        error: 'platformId y payment_frequency son requeridos' 
      }, { status: 400 });
    }

    if (!['quincenal', 'mensual'].includes(payment_frequency)) {
      return NextResponse.json({ 
        success: false, 
        error: 'payment_frequency debe ser "quincenal" o "mensual"' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('calculator_platforms')
      .update({ 
        payment_frequency,
        updated_at: new Date().toISOString()
      })
      .eq('id', platformId)
      .select()
      .single();

    if (error) {
      console.error('❌ [API-PLATFORMS] Error al actualizar plataforma:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, platform: data });

  } catch (error: any) {
    console.error('❌ [API-PLATFORMS] Error en PATCH:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
