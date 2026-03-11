import { NextRequest, NextResponse } from 'next/server';

// Proxy sencillo al Drive Bridge de AutoUpload
const AUTOUpload_DRIVE_BRIDGE_URL = 'https://innovah.app.n8n.cloud/webhook/lovable-to-drive';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(AUTOUpload_DRIVE_BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json(data ?? { success: false, error: 'Respuesta inválida del Drive Bridge' }, {
      status: res.ok ? 200 : res.status
    });
  } catch (error: any) {
    console.error('❌ [AUTOUPLOAD-UPLOAD] Error en proxy:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno en proxy AutoUpload Upload' },
      { status: 500 }
    );
  }
}

