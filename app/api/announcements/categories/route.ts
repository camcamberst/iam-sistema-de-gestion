import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Crear cliente de Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener todas las categorías activas
    const { data: categories, error } = await supabase
      .from('announcement_categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ [ANNOUNCEMENTS-CATEGORIES] Error obteniendo categorías:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: categories || []
    });

  } catch (error: any) {
    console.error('❌ [ANNOUNCEMENTS-CATEGORIES] Error en GET:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}

