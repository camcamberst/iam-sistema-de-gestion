import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

// GET /api/rates - Listar tasas vigentes desde Supabase
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'global';
    const activeOnly = searchParams.get('activeOnly') === 'true';
    
    // Construir query
    let query = supabase
      .from('rates')
      .select('*')
      .order('valid_from', { ascending: false });

    // Aplicar filtros
    if (scope !== 'global') {
      query = query.eq('scope', scope);
    }
    
    if (activeOnly) {
      query = query.is('valid_to', null);
    }

    const { data: rates, error } = await query;

    if (error) {
      throw new Error(`Error de Supabase: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: rates || [],
      meta: {
        total: rates?.length || 0,
        scope,
        activeOnly
      }
    });
  } catch (error: any) {
    console.error('Error en GET /api/rates:', error);
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Error al obtener tasas' },
      { status: 500 }
    );
  }
}

// POST /api/rates - Crear nueva tasa (override manual) con Supabase
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scope, kind, value, author_id } = body;

    // Validaciones básicas
    if (!scope || !kind || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'Datos requeridos: scope, kind, value' },
        { status: 400 }
      );
    }

    if (!['USD→COP', 'EUR→USD', 'GBP→USD'].includes(kind)) {
      return NextResponse.json(
        { success: false, error: 'kind debe ser USD→COP, EUR→USD o GBP→USD' },
        { status: 400 }
      );
    }

    // Desactivar tasa anterior si existe
    await supabase
      .from('rates')
      .update({ valid_to: new Date().toISOString() })
      .eq('kind', kind)
      .eq('scope', scope)
      .is('valid_to', null);

    // Insertar nueva tasa
    const { data: newRate, error } = await supabase
      .from('rates')
      .insert({
        kind,
        value: parseFloat(value),
        scope: scope || 'global',
        scope_id: body.scope_id || null,
        author_id: author_id || null,
        valid_from: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error de Supabase: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: newRate,
      message: 'Tasa creada exitosamente'
    });
  } catch (error: any) {
    console.error('Error en POST /api/rates:', error);
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Error al crear tasa' },
      { status: 500 }
    );
  }
}
