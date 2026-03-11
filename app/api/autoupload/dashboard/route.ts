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

    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error('❌ [AUTOUPLOAD-DASHBOARD] Respuesta no es JSON válido. Status:', res.status, 'Body (primeros 500 chars):', rawText.slice(0, 500));
    }

    console.log('📡 [AUTOUPLOAD-DASHBOARD] action:', body?.action, '| status:', res.status, '| response keys:', data ? Object.keys(data) : 'null', '| is array?', Array.isArray(data));

    if (Array.isArray(data)) {
      console.log('📡 [AUTOUPLOAD-DASHBOARD] La respuesta ES un array directo con', data.length, 'elementos');
      if (data.length > 0) console.log('📡 [AUTOUPLOAD-DASHBOARD] Primer elemento keys:', Object.keys(data[0]), '| sample:', JSON.stringify(data[0]).slice(0, 300));
    } else if (data?.data && Array.isArray(data.data)) {
      console.log('📡 [AUTOUPLOAD-DASHBOARD] data.data es array con', data.data.length, 'elementos');
      if (data.data.length > 0) console.log('📡 [AUTOUPLOAD-DASHBOARD] Primer elemento keys:', Object.keys(data.data[0]), '| sample:', JSON.stringify(data.data[0]).slice(0, 300));
    }

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

