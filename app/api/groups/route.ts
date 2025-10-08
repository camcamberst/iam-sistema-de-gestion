import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log('🏢 [API] Obteniendo grupos...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name, is_manager')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ [API] Error obteniendo grupos:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo grupos' },
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
      { success: false, error: 'Error interno' },
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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