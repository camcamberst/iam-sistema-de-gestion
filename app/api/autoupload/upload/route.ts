import { NextRequest, NextResponse } from 'next/server';

const DASHBOARD_API_URL = 'https://innovah.app.n8n.cloud/webhook/dashboard-api';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const payload = JSON.stringify({
      action: 'bridge-to-drive',
      data: {
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        folderId: body.folderId,
        platform: body.platform
      }
    });

    const res = await fetch(DASHBOARD_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });

    const rawText = await res.text();
    let data: any = null;
    try { data = JSON.parse(rawText); } catch {}

    // n8n puede envolver la respuesta en un array
    if (Array.isArray(data) && data.length > 0) {
      data = data[0];
    }

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data?.message || `Dashboard API respondió HTTP ${res.status}` },
        { status: 200 }
      );
    }

    return NextResponse.json(data ?? { success: true }, { status: 200 });
  } catch (error: any) {
    console.error('❌ [BRIDGE-TO-DRIVE] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno en proxy' },
      { status: 500 }
    );
  }
}

