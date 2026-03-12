import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DRIVE_BRIDGE_URL = 'https://innovah.app.n8n.cloud/webhook/lovable-to-drive';
const DASHBOARD_URL = 'https://innovah.app.n8n.cloud/webhook/dashboard-api';

export async function GET() {
  const results: Record<string, any> = {};

  // Test 1: Dashboard API (sabemos que funciona)
  try {
    const dashRes = await fetch(DASHBOARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-models' })
    });
    const dashText = await dashRes.text();
    results.dashboard = {
      status: dashRes.status,
      ok: dashRes.ok,
      url: dashRes.url,
      redirected: dashRes.redirected,
      bodyPreview: dashText.slice(0, 200)
    };
  } catch (e: any) {
    results.dashboard = { error: e.message };
  }

  // Test 2: Drive Bridge con datos de prueba
  try {
    const driveRes = await fetch(DRIVE_BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileUrl: 'https://placehold.co/100x100.jpg',
        fileName: 'test-ping.jpg',
        folderId: 'test-folder-id',
        platform: 'universal'
      })
    });
    const driveText = await driveRes.text();
    const driveHeaders: Record<string, string> = {};
    driveRes.headers.forEach((v, k) => { driveHeaders[k] = v; });

    results.driveBridge = {
      status: driveRes.status,
      ok: driveRes.ok,
      url: driveRes.url,
      redirected: driveRes.redirected,
      headers: driveHeaders,
      bodyPreview: driveText.slice(0, 500)
    };
  } catch (e: any) {
    results.driveBridge = { error: e.message };
  }

  // Test 3: Drive Bridge con POST vacío
  try {
    const emptyRes = await fetch(DRIVE_BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    results.driveBridgeEmpty = {
      status: emptyRes.status,
      bodyPreview: (await emptyRes.text()).slice(0, 200)
    };
  } catch (e: any) {
    results.driveBridgeEmpty = { error: e.message };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    serverRegion: process.env.VERCEL_REGION || 'unknown',
    results
  }, { status: 200 });
}
