import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Forzar ejecución en servidor
export const dynamic = 'force-dynamic';

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) {
    throw new Error('Variables de entorno de Supabase faltantes (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)');
  }
  return createClient(url, key);
}

function getGenAI() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY as string;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY no está configurada');
  return new GoogleGenerativeAI(apiKey);
}

export async function GET(_req: NextRequest) {
  const startedAt = new Date().toISOString();
  const checks: any = {
    startedAt,
    env: {
      GOOGLE_GEMINI_API_KEY: !!process.env.GOOGLE_GEMINI_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    supabase: { ok: false, bot_memory: null, bot_conversation_summaries: null },
    ai: { ok: false, model: null, latencyMs: null, preview: null, error: null },
  };

  // 1) Verificar Supabase y tablas de memoria
  try {
    const supabase = getSupabaseService();

    // bot_memory
    try {
      const { data, error } = await supabase
        .from('bot_memory')
        .select('id')
        .limit(1);
      checks.supabase.bot_memory = { exists: !error, error: error ? { code: (error as any).code, message: error.message } : null, sample: data?.[0]?.id || null };
    } catch (e: any) {
      checks.supabase.bot_memory = { exists: false, error: { message: e?.message } };
    }

    // bot_conversation_summaries
    try {
      const { data, error } = await supabase
        .from('bot_conversation_summaries')
        .select('conversation_id')
        .limit(1);
      checks.supabase.bot_conversation_summaries = { exists: !error, error: error ? { code: (error as any).code, message: error.message } : null, sample: data?.[0]?.conversation_id || null };
    } catch (e: any) {
      checks.supabase.bot_conversation_summaries = { exists: false, error: { message: e?.message } };
    }

    checks.supabase.ok = !!(checks.supabase.bot_memory?.exists && checks.supabase.bot_conversation_summaries?.exists);
  } catch (e: any) {
    checks.supabase = { ok: false, error: { message: e?.message } };
  }

  // 2) Probar generación mínima con Gemini
  try {
    const genAI = getGenAI();
    const modelNames = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
    ];

    let success = false;
    let usedModel: string | null = null;
    let preview: string | null = null;
    let latencyMs: number | null = null;
    let lastError: any = null;

    for (const name of modelNames) {
      try {
        const m = genAI.getGenerativeModel({ model: name });
        const t0 = Date.now();
        const res = await m.generateContent({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] });
        latencyMs = Date.now() - t0;
        preview = res.response?.text()?.slice(0, 120) || null;
        usedModel = name;
        success = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    checks.ai.ok = success;
    checks.ai.model = usedModel;
    checks.ai.preview = preview;
    checks.ai.latencyMs = latencyMs;
    if (!success && lastError) {
      checks.ai.error = {
        message: (lastError as any)?.message,
        code: (lastError as any)?.code,
      };
    }
  } catch (e: any) {
    checks.ai = { ok: false, error: { message: e?.message } };
  }

  // Resultado
  return NextResponse.json({ success: true, checks }, { status: 200 });
}


