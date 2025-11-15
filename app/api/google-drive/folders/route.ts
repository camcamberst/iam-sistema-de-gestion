import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedOAuth2Client } from '@/lib/google-drive/auth';

export const dynamic = 'force-dynamic';

// GET: Listar carpetas dentro de un folder de Google Drive
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const userId = searchParams.get('userId'); // ID del usuario autenticado

    if (!folderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'folderId es requerido' 
      }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId es requerido' 
      }, { status: 400 });
    }

    try {
      // Obtener cliente OAuth2 autenticado
      const oauth2Client = await getAuthenticatedOAuth2Client(userId);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Listar carpetas dentro del folder
      const response = await drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        orderBy: 'name'
      });

      const folders = (response.data.files || []).map(file => ({
        id: file.id!,
        name: file.name!
      }));

      return NextResponse.json({
        success: true,
        folders
      });

    } catch (authError: any) {
      // Si el error es de autenticación, retornar información para iniciar OAuth
      if (authError.message.includes('no autenticado') || authError.message.includes('no está configurado')) {
        return NextResponse.json({
          success: false,
          error: authError.message,
          requiresAuth: true,
          requiresSetup: authError.message.includes('no está configurado')
        }, { status: 401 });
      }
      throw authError;
    }

  } catch (error: any) {
    console.error('❌ [GOOGLE-DRIVE-FOLDERS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al listar carpetas'
    }, { status: 500 });
  }
}

