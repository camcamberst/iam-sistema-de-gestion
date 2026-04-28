import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener tasas activas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'global';
    const activeOnly = searchParams.get('activeOnly') === 'true';
    
    console.log('🔍 [RATES-V2] Loading rates:', { scope, activeOnly });

    // Construir query
    let query = supabase
      .from('rates')
      .select('*')
      .eq('active', true)
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
      console.error('Error al obtener tasas:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('🔍 [RATES-V2] Found rates:', rates);
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
    console.error('❌ [RATES-V2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// POST: Crear nueva tasa
export async function POST(request: NextRequest) {
  try {
    const { kind, value, scope, scopeId, authorId } = await request.json();

    if (!kind || !value || !authorId) {
      return NextResponse.json({ success: false, error: 'kind, value y authorId son requeridos' }, { status: 400 });
    }

    console.log('🔍 [RATES-V2] Creating rate:', { kind, value, scope, scopeId, authorId });

    // Desactivar tasa anterior si existe
    await supabase
      .from('rates')
      .update({ valid_to: new Date().toISOString() })
      .eq('kind', kind)
      .eq('scope', scope)
      .eq('scope_id', scopeId)
      .is('valid_to', null);

    // Crear nueva tasa
    const { data, error } = await supabase
      .from('rates')
      .insert({
        kind,
        value: parseFloat(value),
        scope: scope || 'global',
        scope_id: scopeId || null,
        author_id: authorId,
        valid_from: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear tasa:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('🔍 [RATES-V2] Created rate:', data);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('❌ [RATES-V2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
