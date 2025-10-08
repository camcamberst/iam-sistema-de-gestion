import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log('🏢 [API] Obteniendo grupos...');
    
    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ [API] Variables de entorno faltantes:', {
        url: !!supabaseUrl,
        key: !!supabaseKey
      });
      return NextResponse.json(
        { success: false, error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name, is_manager')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ [API] Error obteniendo grupos:', error);
      return NextResponse.json(
        { success: false, error: `Error obteniendo grupos: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('✅ [API] Grupos obtenidos:', groups?.length || 0);

    return NextResponse.json({
      success: true,
      groups: groups || []
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: `Error interno: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🏢 [API] Creando grupo...');
    
    const { name } = await request.json();
    
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre del grupo es requerido' },
        { status: 400 }
      );
    }

    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ [API] Variables de entorno faltantes:', {
        url: !!supabaseUrl,
        key: !!supabaseKey
      });
      return NextResponse.json(
        { success: false, error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name: name.trim(),
        is_manager: false
      })
      .select('id, name, is_manager')
      .single();

    if (error) {
      console.error('❌ [API] Error creando grupo:', error);
      
      // Manejar error de duplicado
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Ya existe un grupo con ese nombre' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: 'Error creando grupo' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Grupo creado:', group);

    return NextResponse.json({
      success: true,
      group
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}