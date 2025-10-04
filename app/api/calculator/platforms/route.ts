import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
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
      data: data || []
    };

    console.log('🔍 [API-PLATFORMS] Response final:', response);
    console.log('🔍 [API-PLATFORMS] Response data length:', response.data?.length);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [API-PLATFORMS] Error en /api/calculator/platforms:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
