import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedOAuth2Client } from '@/lib/google-drive/auth';
import { Readable } from 'stream';

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
      console.log('🔍 [GOOGLE-DRIVE-UPLOAD] Iniciando upload:', { 
        fileName: file.name, 
        folderId, 
        modelId, 
        userId, 
        fileSize: file.size, 
        fileType: file.type 
      });
      
      // Obtener cliente OAuth2 autenticado
      console.log('🔍 [GOOGLE-DRIVE-UPLOAD] Obteniendo cliente OAuth2 para userId:', userId);
      const oauth2Client = await getAuthenticatedOAuth2Client(userId);
      console.log('✅ [GOOGLE-DRIVE-UPLOAD] Cliente OAuth2 obtenido exitosamente');
      
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      console.log('✅ [GOOGLE-DRIVE-UPLOAD] Cliente Drive inicializado');
      
      // Convertir File a Buffer y luego a Stream
      console.log('📤 [GOOGLE-DRIVE-UPLOAD] Convirtiendo archivo a buffer...');
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log('✅ [GOOGLE-DRIVE-UPLOAD] Buffer creado, tamaño:', buffer.length, 'bytes');
      
      // Convertir Buffer a Stream (requerido por Google Drive API)
      const stream = Readable.from(buffer);
      console.log('✅ [GOOGLE-DRIVE-UPLOAD] Stream creado desde buffer');

      // Verificar que el folderId existe y es accesible
      console.log('🔍 [GOOGLE-DRIVE-UPLOAD] Verificando acceso a carpeta:', folderId);
      try {
        await drive.files.get({
          fileId: folderId,
          fields: 'id, name, mimeType'
        });
        console.log('✅ [GOOGLE-DRIVE-UPLOAD] Carpeta verificada y accesible');
      } catch (folderError: any) {
        console.error('❌ [GOOGLE-DRIVE-UPLOAD] Error verificando carpeta:', {
          message: folderError.message,
          code: folderError.code,
          errors: folderError.errors
        });
        throw new Error(`No se puede acceder a la carpeta: ${folderError.message}`);
      }

      // Subir archivo
      console.log('📤 [GOOGLE-DRIVE-UPLOAD] Iniciando subida de archivo a Google Drive...');
      const response = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [folderId]
        },
        media: {
          mimeType: file.type,
          body: stream  // Usar stream en lugar de buffer
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

      // Si el error es de autenticación o scope insuficiente, retornar información para iniciar OAuth
      if (authError.message?.includes('no autenticado') || 
          authError.message?.includes('no está configurado') ||
          authError.message?.includes('necesita reautenticarse') ||
          authError.code === 401 ||
          authError.code === 403) {
        return NextResponse.json({
          success: false,
          error: authError.message || 'Error de autenticación con Google Drive. Por favor, vuelve a autenticarte.',
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

