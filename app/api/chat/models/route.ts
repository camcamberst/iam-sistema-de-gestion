import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// Endpoint para obtener lista de modelos (para el ChatWidget)
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar que sea admin o super_admin
    const { data: userRow } = await supabaseServer
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userRow || (userRow.role !== 'admin' && userRow.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Obtener lista de modelos
    const { data: models, error } = await supabaseServer
      .from('users')
      .select('id, name, email, role')
      .eq('role', 'modelo')
      .order('name');

    if (error) {
      console.error('Error loading models:', error);
      return NextResponse.json({ error: 'Error al cargar modelos' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      models: models || [],
      count: models?.length || 0
    });

  } catch (error) {
    console.error('Error en endpoint de modelos:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

