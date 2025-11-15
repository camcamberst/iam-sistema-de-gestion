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
      console.log('🔍 [GOOGLE-DRIVE-UPLOAD] Iniciando upload:', { fileName: file.name, folderId, modelId, userId, fileSize: file.size, fileType: file.type });
      
      // Obtener cliente OAuth2 autenticado
      const oauth2Client = await getAuthenticatedOAuth2Client(userId);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Convertir File a Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log('📤 [GOOGLE-DRIVE-UPLOAD] Buffer creado, tamaño:', buffer.length, 'bytes');

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

      console.log('✅ [GOOGLE-DRIVE-UPLOAD] Archivo subido exitosamente:', {
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink
      });

      return NextResponse.json({
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink
      });

    } catch (authError: any) {
      console.error('❌ [GOOGLE-DRIVE-UPLOAD] Error en upload:', {
        message: authError.message,
        code: authError.code,
        errors: authError.errors,
        stack: authError.stack
      });

      // Si el error es de autenticación, retornar información para iniciar OAuth
      if (authError.message?.includes('no autenticado') || 
          authError.message?.includes('no está configurado') ||
          authError.code === 401 ||
          authError.code === 403) {
        return NextResponse.json({
          success: false,
          error: authError.message || 'Error de autenticación con Google Drive',
          requiresAuth: true,
          requiresSetup: authError.message?.includes('no está configurado')
        }, { status: 401 });
      }

      // Si es un error de permisos o acceso
      if (authError.code === 403 || authError.message?.includes('permission') || authError.message?.includes('access')) {
        return NextResponse.json({
          success: false,
          error: `Error de permisos: ${authError.message || 'No tienes permisos para subir archivos a esta carpeta'}`,
          requiresAuth: true
        }, { status: 403 });
      }

      // Otros errores de Google Drive API
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

