import { NextRequest, NextResponse } from 'next/server';

// Proxy sencillo al Drive Bridge de AutoUpload
const AUTOUpload_DRIVE_BRIDGE_URL = 'https://innovah.app.n8n.cloud/webhook/lovable-to-drive';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📤 [AUTOUPLOAD-UPLOAD] Enviando al Drive Bridge:', JSON.stringify({
      fileUrl: body.fileUrl?.slice(0, 80),
      fileName: body.fileName,
      folderId: body.folderId,
      platform: body.platform
    }));

    const res = await fetch(AUTOUpload_DRIVE_BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const rawText = await res.text();
    let data: any = null;
    try { data = JSON.parse(rawText); } catch {}

    console.log('📥 [AUTOUPLOAD-UPLOAD] Respuesta Drive Bridge:', res.status, rawText.slice(0, 300));

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Drive Bridge respondió HTTP ${res.status}`, detail: rawText.slice(0, 200) },
        { status: res.status }
      );
    }

    return NextResponse.json(data ?? { success: true }, { status: 200 });
  } catch (error: any) {
    console.error('❌ [AUTOUPLOAD-UPLOAD] Error en proxy:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno en proxy AutoUpload Upload' },
      { status: 500 }
    );
  }
}

