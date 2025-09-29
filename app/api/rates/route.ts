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

// POST /api/rates - Crear nueva tasa (override manual)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scope, kind, value_raw, adjustment, value_effective, source, author_id } = body;

    // Validaciones básicas
    if (!scope || !kind || value_effective === undefined) {
      return NextResponse.json(
        { success: false, error: 'Datos requeridos: scope, kind, value_effective' },
        { status: 400 }
      );
    }

    if (!['USD_COP', 'EUR_USD', 'GBP_USD'].includes(kind)) {
      return NextResponse.json(
        { success: false, error: 'kind debe ser USD_COP, EUR_USD o GBP_USD' },
        { status: 400 }
      );
    }

    // Crear nueva tasa
    const newRate = {
      id: (mockRates.length + 1).toString(),
      scope,
      kind,
      value_raw: value_raw || value_effective,
      adjustment: adjustment || 0,
      value_effective,
      source: source || 'manual',
      author_id: author_id || 'admin',
      valid_from: new Date(),
      valid_to: null,
      period_base: false,
      created_at: new Date()
    };

    mockRates.push(newRate);

    return NextResponse.json({
      success: true,
      data: newRate,
      message: 'Tasa creada exitosamente'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Error al crear tasa' },
      { status: 500 }
    );
  }
}
