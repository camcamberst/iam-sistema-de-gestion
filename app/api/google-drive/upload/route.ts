import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedOAuth2Client } from '@/lib/google-drive/auth';

export const dynamic = 'force-dynamic';

// POST: Subir archivo a Google Drive
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folderId = formData.get('folderId') as string;
    const modelId = formData.get('modelId') as string;
    const userId = formData.get('userId') as string; // ID del usuario que está subiendo

    if (!file || !folderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Archivo y folderId son requeridos' 
      }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId es requerido' 
      }, { status: 400 });
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Solo se permiten archivos de imagen' 
      }, { status: 400 });
    }

    try {
      // Obtener cliente OAuth2 autenticado
      const oauth2Client = await getAuthenticatedOAuth2Client(userId);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Convertir File a Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Subir archivo
      const response = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [folderId]
        },
        media: {
          mimeType: file.type,
          body: buffer
        },
        fields: 'id, name, webViewLink'
      });

      console.log('✅ [GOOGLE-DRIVE-UPLOAD] Archivo subido exitosamente:', response.data.name);

      return NextResponse.json({
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink
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
    console.error('❌ [GOOGLE-DRIVE-UPLOAD] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al subir archivo'
    }, { status: 500 });
  }
}

