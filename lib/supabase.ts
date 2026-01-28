"use client";
import { createClient } from "@supabase/supabase-js";

// Valores por defecto hardcodeados - estos son los valores reales de producción
const SUPABASE_URL = "https://mhernfrkvwigxdubiozm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c";

// Obtener valores de variables de entorno si están disponibles, sino usar defaults
const supabaseUrl = 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) || 
  SUPABASE_URL;

const supabaseAnonKey = 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON) ||
  SUPABASE_ANON_KEY;

// Asegurarse de que siempre tengamos valores válidos
const finalUrl = supabaseUrl && supabaseUrl.trim() !== '' ? supabaseUrl : SUPABASE_URL;
const finalKey = supabaseAnonKey && supabaseAnonKey.trim() !== '' ? supabaseAnonKey : SUPABASE_ANON_KEY;

// Validación final
if (!finalUrl || finalUrl.trim() === '') {
  throw new Error('Supabase URL is required');
}

if (!finalKey || finalKey.trim() === '') {
  throw new Error('Supabase anon key is required');
}

// Crear el cliente directamente con valores garantizados
export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
