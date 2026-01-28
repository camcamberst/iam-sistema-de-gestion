"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Valores hardcodeados garantizados - estos son los valores reales de producción
const SUPABASE_URL = "https://mhernfrkvwigxdubiozm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c";

// Cliente singleton - se inicializa solo cuando se accede por primera vez
let _supabaseClient: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  if (_supabaseClient) {
    return _supabaseClient;
  }

  // Intentar obtener de variables de entorno, sino usar valores hardcodeados
  const url = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) || SUPABASE_URL;
  const key = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
              (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON) ||
              SUPABASE_ANON_KEY;

  // Validar que tengamos valores válidos
  const finalUrl = url && url.trim() !== '' ? url : SUPABASE_URL;
  const finalKey = key && key.trim() !== '' ? key : SUPABASE_ANON_KEY;

  _supabaseClient = createClient(finalUrl, finalKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });

  return _supabaseClient;
}

// Exportar como getter que inicializa solo cuando se accede
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = createSupabaseClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});
