import { NextRequest, NextResponse } from 'next/server';

const DRIVE_BRIDGE_URL = 'https://innovah.app.n8n.cloud/webhook/lovable-to-drive';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const payload = JSON.stringify({
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      folderId: body.folderId,
      platform: body.platform
    });

    console.log('📤 [DRIVE-BRIDGE] URL:', DRIVE_BRIDGE_URL);
    console.log('📤 [DRIVE-BRIDGE] Método: POST');
    console.log('📤 [DRIVE-BRIDGE] Payload:', payload.slice(0, 300));

    const res = await fetch(DRIVE_BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      redirect: 'follow'
    });

    const rawText = await res.text();

    console.log('📥 [DRIVE-BRIDGE] Status:', res.status);
    console.log('📥 [DRIVE-BRIDGE] URL final (post-redirect):', res.url);
    console.log('📥 [DRIVE-BRIDGE] Redirected:', res.redirected);
    console.log('📥 [DRIVE-BRIDGE] Body:', rawText.slice(0, 500));

    let data: any = null;
    try { data = JSON.parse(rawText); } catch {}

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `Drive Bridge respondió HTTP ${res.status}`,
        debug: {
          targetUrl: DRIVE_BRIDGE_URL,
          finalUrl: res.url,
          redirected: res.redirected,
          status: res.status,
          body: rawText.slice(0, 300)
        }
      }, { status: 200 });
    }

    return NextResponse.json(data ?? { success: true }, { status: 200 });
  } catch (error: any) {
    console.error('❌ [DRIVE-BRIDGE] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno en proxy' },
      { status: 500 }
    );
  }
}

