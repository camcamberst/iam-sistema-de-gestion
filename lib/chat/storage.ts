import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'chat-attachments';

export interface UploadResult {
  url: string | null;
  error: Error | null;
}

/**
 * Sube un archivo al bucket de chat-attachments en Supabase.
 * @param file El archivo a subir
 * @param conversationId El ID de la conversación (para organizar carpetas)
 * @returns La URL pública del archivo subido o un error
 */
export async function uploadChatAttachment(file: File, conversationId: string): Promise<UploadResult> {
  try {
    // Generar un nombre de archivo único
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${conversationId}/${fileName}`;

    // Subir el archivo
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ [Storage] Error subiendo archivo:', error);
      return { url: null, error };
    }

    // Obtener la URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error('❌ [Storage] Excepción subiendo archivo:', error);
    return { url: null, error: error as Error };
  }
}
