import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserMemories, saveMemory, deleteMemory } from '@/lib/chat/bot-memory';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET: Obtener memorias del usuario
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autorización requerido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const memories = await getUserMemories(
      user.id,
      type as any || undefined
    );

    return NextResponse.json({
      success: true,
      data: memories
    });

  } catch (error: any) {
    console.error('Error en GET /api/admin/bot-memory:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error obteniendo memorias' 
    }, { status: 500 });
  }
}

// DELETE: Eliminar una memoria específica
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autorización requerido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { key } = body;

    if (!key) {
      return NextResponse.json({ error: 'Key requerida' }, { status: 400 });
    }

    const success = await deleteMemory(user.id, key);

    return NextResponse.json({
      success,
      message: success ? 'Memoria eliminada' : 'Error eliminando memoria'
    });

  } catch (error: any) {
    console.error('Error en DELETE /api/admin/bot-memory:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error eliminando memoria' 
    }, { status: 500 });
  }
}



