import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET: Obtener configuración de Google Drive para un modelo
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId es requerido' 
      }, { status: 400 });
    }

    const supabase = supabaseServer;

    // Obtener el usuario (modelo)
    const { data: model, error: modelError } = await supabase
      .from('users')
      .select('id, email, name, google_drive_folder_url')
      .eq('id', modelId)
      .eq('role', 'modelo')
      .single();

    if (modelError) {
      console.error('❌ [GOOGLE-DRIVE-CONFIG] Error al obtener modelo:', modelError);
      return NextResponse.json({ 
        success: false, 
        error: 'Modelo no encontrado' 
      }, { status: 404 });
    }

    const folderUrl = model.google_drive_folder_url || null;
    let folderId: string | null = null;

    if (folderUrl) {
      // Extraer folder ID de la URL
      const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      folderId = match ? match[1] : null;
    }

    return NextResponse.json({
      success: true,
      folderUrl,
      folderId
    });

  } catch (error: any) {
    console.error('❌ [GOOGLE-DRIVE-CONFIG] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// POST: Guardar/actualizar configuración de Google Drive para un modelo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, folderUrl, folderId } = body;

    if (!modelId || !folderUrl) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId y folderUrl son requeridos' 
      }, { status: 400 });
    }

    const supabase = supabaseServer;

    // Verificar que el modelo existe
    const { data: model, error: modelError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', modelId)
      .eq('role', 'modelo')
      .single();

    if (modelError || !model) {
      console.error('❌ [GOOGLE-DRIVE-CONFIG] Error al verificar modelo:', modelError);
      return NextResponse.json({ 
        success: false, 
        error: 'Modelo no encontrado' 
      }, { status: 404 });
    }

    // Actualizar el campo google_drive_folder_url
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        google_drive_folder_url: folderUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', modelId);

    if (updateError) {
      console.error('❌ [GOOGLE-DRIVE-CONFIG] Error al actualizar configuración:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al guardar configuración' 
      }, { status: 500 });
    }

    console.log('✅ [GOOGLE-DRIVE-CONFIG] Configuración guardada para modelo:', modelId);

    return NextResponse.json({
      success: true,
      message: 'Configuración guardada correctamente',
      folderUrl,
      folderId
    });

  } catch (error: any) {
    console.error('❌ [GOOGLE-DRIVE-CONFIG] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

