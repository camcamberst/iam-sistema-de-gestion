import { NextRequest, NextResponse } from 'next/server';

// Proxy sencillo al Dashboard API de AutoUpload
const AUTOUpload_DASHBOARD_URL = 'https://innovah.app.n8n.cloud/webhook/dashboard-api';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(AUTOUpload_DASHBOARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json(data ?? { success: false, error: 'Respuesta inválida del Dashboard API' }, {
      status: res.ok ? 200 : res.status
    });
  } catch (error: any) {
    console.error('❌ [AUTOUPLOAD-DASHBOARD] Error en proxy:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno en proxy AutoUpload Dashboard' },
      { status: 500 }
    );
  }
}

