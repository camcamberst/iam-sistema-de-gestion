import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeAnalyticsQuery, type AnalyticsQuery } from '@/lib/chat/bot-analytics';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST: Ejecutar consulta analítica
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Obtener token de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autorización requerido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Obtener rol del usuario
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { query }: { query: AnalyticsQuery } = body;

    if (!query || !query.type) {
      return NextResponse.json({ 
        error: 'Consulta analítica requerida (query.type)' 
      }, { status: 400 });
    }

    console.log('📊 [ANALYTICS-API] Ejecutando consulta:', {
      type: query.type,
      params: query.params,
      userId: user.id,
      role: userData.role
    });

    // Ejecutar consulta analítica
    const result = await executeAnalyticsQuery(
      query,
      user.id,
      userData.role as 'super_admin' | 'admin' | 'modelo'
    );

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ [ANALYTICS-API] Error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error ejecutando consulta analítica' 
    }, { status: 500 });
  }
}



