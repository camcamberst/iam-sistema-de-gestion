import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const runtime = 'nodejs';
export const maxDuration = 30;

// Sube una imagen al bucket de Supabase y devuelve una URL pública
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Usuario no autenticado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se proporcionó ningún archivo' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Tipo de archivo no permitido' }, { status: 400 });
    }

    const maxSize = 8 * 1024 * 1024; // 8MB para Boost (más alto que anuncios)
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: 'El archivo es demasiado grande. El límite máximo es 8MB.'
        },
        { status: 400 }
      );
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/boost/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('announcement-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ [BOOST-UPLOAD] Error subiendo imagen:', uploadError);
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl }
    } = supabase.storage.from('announcement-images').getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName
    });
  } catch (error: any) {
    console.error('❌ [BOOST-UPLOAD] Error en POST:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 }
    );
  }
}

